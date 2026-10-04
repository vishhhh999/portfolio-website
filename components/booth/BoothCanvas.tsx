'use client';

import { advance, Canvas, events as createPointerEvents, useFrame, useThree, type RootState } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { Suspense, useEffect, useRef, useState } from 'react';
import { loadLTC } from '@/lib/ltc';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { lineup } from '@/content/work';
import { attachRenderer, requestFrames, setContinuous } from '@/lib/clock';
import { lampById } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { onViewsChanged, stageRect } from '@/lib/views';
import { BoothRoom, CalibrationProps } from './BoothRoom';
import { CameraRig } from './CameraRig';
import { LampRig } from './LampRig';
import { ObjectSlot } from './ObjectSlot';
import { PerfProbe } from './PerfProbe';
import { perfInfo } from '@/lib/perfTier';
import { modelsSettled } from './models';
import { contextLost, contextRestored } from '@/lib/resilience';
import { Post } from './Post';
import { ModelRef } from './ModelRef';
import { ProofLayer } from './ProofLayer';
import { lineupShot, trayShot } from './shots';
import { BOOTH, CABINET_FACE, FACE_Z, FOCAL_MM, FOV, PLINTH_CHAMFER, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY, lineupLayout } from './staging';

declare global {
  interface Window {
    __boothBench?: (n?: number) => { p50: number; p95: number };
  }
  interface Window {
    /** Projected width of every sample (object only, no plinth) as % of the viewport width, from the live camera. */
    __boothSizes?: () => Record<string, number>;
    __boothMounts?: number;
    /** Staging + camera data for tools/export-camera.mjs (Blender scene). */
    __boothExport?: (aspect: number) => unknown;
    __boothGreyCard?: () => { x: number; y: number };
  }
}

const SLUGS = lineup.map((w) => w.slug);
/** ?modelref=<slug>: one GLB alone, like its Blender reference render (tools/model-ref.mjs). */
const MODEL_REF = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('modelref') : null;
const LAYOUT = lineupLayout(SLUGS);

/** Booth pointer events only inside the stage rect (the camera's projection spans the whole canvas). */
function stageEvents(store: Parameters<typeof createPointerEvents>[0]) {
  const base = createPointerEvents(store);
  return {
    ...base,
    compute(event: { clientX: number; clientY: number; target: EventTarget | null }, state: RootState) {
      const r = stageRect();
      const t = event.target as Element | null;
      // events bubble to <body>; ignore any that started on real page UI over the booth
      const onUi = !!t?.closest?.('a, button, input, .panel, .masthead, .work__body, .footer, .houselights, .page');
      const inside =
        !onUi && r && event.clientX >= r.left && event.clientX <= r.left + r.width && event.clientY >= r.top && event.clientY <= r.top + r.height;
      if (!r || !inside) state.pointer.set(9, 9);
      else state.pointer.set((event.clientX / state.size.width) * 2 - 1, -(event.clientY / state.size.height) * 2 + 1);
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
  };
}

/** Exposes window.__boothSizes for tools/check-sizes.mjs (projects through the live camera, lens shift included). */
function SizeProbe() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    window.__boothSizes = () => {
      // % of the cabinet's projected width (the cabinet face, at the opening)
      const fz = FACE_Z;
      const ca = new Vector3(-CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cb = new Vector3(CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cab = cb.x - ca.x;
      const out: Record<string, number> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const y = st.base.h + st.object.h / 2;
        const z = st.z + st.object.d / 2;
        const a = new Vector3(st.x - st.object.w / 2, y, z).project(camera);
        const b = new Vector3(st.x + st.object.w / 2, y, z).project(camera);
        out[w.slug] = +(((b.x - a.x) / cab) * 100).toFixed(1);
      }
      return out;
    };
    // the grey card (the 24-patch chart's N5 patch, 18% reflectance) in viewport CSS px, for exposure calibration
    window.__boothGreyCard = () => {
      const { checker: ch, ledge } = PROPS;
      // N5 is row 4, column 4 of the chart; the texture's patch grid (tools/gen-assets.py)
      const u = 648 / 1116, vTop = 726 / 864;
      const local = new Vector3((u - 0.5) * ch.w, (1 - vTop) * ch.h, 0.0016);
      const m = new Matrix4().compose(new Vector3(ch.x, ledge.y + ledge.h, BOOTH.backZ + 0.032), new Quaternion().setFromEuler(new Euler(-ch.lean, ch.yaw, 0)), new Vector3(1, 1, 1));
      const p = local.applyMatrix4(m).project(camera);
      const W = window.innerWidth, H = window.innerHeight;
      return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H };
    };
  }, [camera]);
  return null;
}

/** Hooks the canvas onto the page's single clock and reports the first lit frames. */
function ClockBridge({ onReady }: { onReady: () => void }) {
  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const frames = useRef(0);
  useEffect(() => {
    // Our invalidate: ask the shared clock for frames instead of R3F's own loop.
    set({ invalidate: (n?: number) => requestFrames(n ?? 1) });
    attachRenderer((t) => advance(t, true, get()));
    const off = onViewsChanged(() => requestFrames(2));
    // ?perf: render N frames synchronously, each closed with a 1px readback, and time them. A
    // like-for-like cost per lamp / per tier, independent of the display's refresh cadence.
    if (window.location.search.includes('perf')) {
      window.__boothBench = (n = 30) => {
        const ctx = get().gl.getContext();
        const px = new Uint8Array(4);
        const frame = () => {
          advance(performance.now() / 1000, true, get());
          ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); // a real sync point (finish() may not block)
        };
        for (let i = 0; i < 4; i++) frame(); // warm-up: shader compiles, texture uploads
        const ms: number[] = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          frame();
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return { p50: +ms[Math.floor(n * 0.5)].toFixed(1), p95: +ms[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(1) };
      };
    }
    return () => {
      attachRenderer(null);
      off();
    };
  }, [get, set]);
  const lamp = useBooth((s) => s.lamp);
  useEffect(() => setContinuous(lampById(lamp).continuous), [lamp]);
  // Ready (the poster crossfades to the live booth) once three lit frames are drawn and every GLB
  // is in, so the booth never appears half-lit or half-built; at most 8s after mount regardless.
  const t0 = useRef(performance.now());
  const done = useRef(false);
  useFrame(() => {
    frames.current++;
    if (done.current || frames.current < 3) return;
    if (modelsSettled() || performance.now() - t0.current > 8000) {
      done.current = true;
      onReady();
    } else requestFrames(1);
  }, 2);
  return null;
}

/**
 * The one and only canvas: fixed, full-screen, transparent, behind the page,
 * never remounted. It draws the booth into the stage rect and the proof-strip
 * planes into their image rects, on demand, from the page's single clock.
 */
export default function BoothCanvas({ onReady, lightmap = null }: { onReady: () => void; lightmap?: string | null }) {
  useEffect(() => {
    window.__boothMounts = (window.__boothMounts ?? 0) + 1;
    window.__boothExport = (aspect: number) => ({
      units: 'metres',
      fovVerticalDeg: FOV,
      sensorHeightMm: SENSOR_HEIGHT_MM,
      focalLengthMm: FOCAL_MM,
      aspect,
      lineup: lineupShot(aspect),
      tray: Object.fromEntries(lineup.map((w) => [w.slug, trayShot(w.slug, aspect)])),
      booth: BOOTH,
      tray_plate: TRAY,
      plinthChamfer: PLINTH_CHAMFER,
      bases: lineup.map((w) => ({
        slug: w.slug,
        position: [LAYOUT.x[w.slug], STAGING[w.slug].base.h / 2, LAYOUT.z[w.slug]],
        size: STAGING[w.slug].base,
        objectBase: [LAYOUT.x[w.slug], STAGING[w.slug].base.h, LAYOUT.z[w.slug]],
        objectSize: STAGING[w.slug].object,
      })),
      props: PROPS,
    });
  }, []);

  // the area lights' lookup tables arrive as a texture before anything renders
  const [ltc, setLtc] = useState(false);
  useEffect(() => {
    void loadLTC().then(() => setLtc(true));
  }, []);

  const perf = perfInfo();
  const mobile = perf.tier === 'mobile';

  return (
    <Canvas
      frameloop="never"
      shadows="percentage"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, perf.dprCap) : 1}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV, position: [0, 0.4, 5] }}
      events={stageEvents}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      onPointerMissed={() => (document.body.style.cursor = '')}
      onCreated={({ gl }) => {
        // I4: a lost context drops to house lights at once; a restored one brings the booth back
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          contextLost();
        });
        gl.domElement.addEventListener('webglcontextrestored', () => contextRestored());
      }}
    >
      {ltc && <ClockBridge onReady={onReady} />}
      {!ltc ? null : MODEL_REF ? (
        <ModelRef slug={MODEL_REF} />
      ) : (
        <>
          <SizeProbe />
          <CameraRig />
          <LampRig />
          <SoftShadows size={mobile ? 18 : 26} samples={mobile ? 8 : 14} focus={0.2} />
          <BoothRoom lineup={SLUGS} lightmap={lightmap} />
          {lineup.map((w) => (
            <ObjectSlot key={w.slug} work={w} lineup={SLUGS} />
          ))}
          <Suspense fallback={null}>
            <CalibrationProps />
          </Suspense>
          <ProofLayer />
        </>
      )}
      <Post />
      <PerfProbe readout={typeof window !== 'undefined' && window.location.search.includes('perf')} />
    </Canvas>
  );
}
