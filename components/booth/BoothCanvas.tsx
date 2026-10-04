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
import { lineupShot, trayShot } from './shots';
import { BOOTH, CABINET_FACE, FACE_Z, FOCAL_MM, FOV, PLINTH_CHAMFER, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY, lineupLayout } from './staging';

declare global {
  interface Window {
    __boothBench?: (n?: number) => { p50: number; p95: number };
  }
  interface Window {
    /** Projected width of every sample (object only, no plinth) as % of the viewport width, from the live camera. */
    __boothSizes?: () => Record<string, number>;
    /** F1: every sample's projected box (viewport px) and the smallest 3D clearance between any two samples (m). */
    __boothBoxes?: () => { boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }>; minGap: { m: number; a: string; b: string } };
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
      // events bubble to <body>; ignore any that started on real page UI over the booth. The masthead's
      // empty space is not UI: on project pages the raised samples sit under it and must stay clickable
      // (its links and buttons are caught by "a, button").
      const onUi = !!t?.closest?.('a, button, input, .panel, .work__body, .footer, .houselights, .page');
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
    window.__boothBoxes = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
      const aabb: Record<string, [number, number, number, number, number, number]> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const { w: ow, h: oh, d: od } = st.object;
        const y0 = st.base.h;
        aabb[w.slug] = [st.x - ow / 2, y0, st.z - od / 2, st.x + ow / 2, y0 + oh, st.z + od / 2];
        let x0 = Infinity, yy0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const cx of [st.x - ow / 2, st.x + ow / 2])
          for (const cy of [y0, y0 + oh])
            for (const cz of [st.z - od / 2, st.z + od / 2]) {
              const v = new Vector3(cx, cy, cz).project(camera);
              const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
              x0 = Math.min(x0, px); x1 = Math.max(x1, px); yy0 = Math.min(yy0, py); y1 = Math.max(y1, py);
            }
        boxes[w.slug] = { x0, y0: yy0, x1, y1 };
      }
      let minGap = { m: Infinity, a: '', b: '' };
      const slugs = Object.keys(aabb);
      for (let i = 0; i < slugs.length; i++)
        for (let j = i + 1; j < slugs.length; j++) {
          const A = aabb[slugs[i]], B = aabb[slugs[j]];
          const dx = Math.max(0, A[0] - B[3], B[0] - A[3]);
          const dy = Math.max(0, A[1] - B[4], B[1] - A[4]);
          const dz = Math.max(0, A[2] - B[5], B[2] - A[5]);
          const d = Math.hypot(dx, dy, dz);
          if (d < minGap.m) minGap = { m: +d.toFixed(3), a: slugs[i], b: slugs[j] };
        }
      return { boxes, minGap };
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
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    frames.current++;
    if (done.current || frames.current < 3) return;
    if (modelsSettled() || performance.now() - t0.current > 8000) {
      done.current = true;
      onReady();
      // A3: compile every program the scene can need (hidden pieces included: the haze cone, the
      // tray-shot neighbours) once, while idle, so no lamp or route change ever compiles a shader
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle(() => {
        const hidden: { visible: boolean }[] = [];
        scene.traverse((o) => {
          if (!o.visible) {
            hidden.push(o);
            o.visible = true;
          }
        });
        // synchronous, so no frame can ever be drawn while the hidden pieces are switched on
        gl.compile(scene, camera);
        hidden.forEach((o) => (o.visible = false));
      });
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
        </>
      )}
      <Post />
      <PerfProbe readout={typeof window !== 'undefined' && window.location.search.includes('perf')} />
    </Canvas>
  );
}
