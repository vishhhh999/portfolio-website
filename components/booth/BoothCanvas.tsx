'use client';

import { advance, Canvas, events as createPointerEvents, useFrame, useThree, type RootState } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
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
import { Post } from './Post';
import { ProofLayer } from './ProofLayer';
import { lineupShot, trayShot } from './shots';
import { BOOTH, CABINET, CABINET_FACE, FOCAL_MM, FOV, PLINTH_CHAMFER, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY, lineupLayout } from './staging';

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
  }
}

const SLUGS = lineup.map((w) => w.slug);
const LAYOUT = lineupLayout(SLUGS);

/** Booth pointer events only inside the stage rect, with NDC relative to that rect (the booth's own viewport). */
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
      else state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
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
      const fz = BOOTH.frontZ + CABINET.proud;
      const ca = new Vector3(-CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cb = new Vector3(CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cab = cb.x - ca.x;
      const out: Record<string, number> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const y = st.plinth.h + st.object.h / 2;
        const z = st.z + st.object.d / 2;
        const a = new Vector3(st.x - st.object.w / 2, y, z).project(camera);
        const b = new Vector3(st.x + st.object.w / 2, y, z).project(camera);
        out[w.slug] = +(((b.x - a.x) / cab) * 100).toFixed(1);
      }
      return out;
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
  useFrame(() => {
    frames.current++;
    if (frames.current === 3) onReady();
  }, 2);
  return null;
}

/**
 * The one and only canvas: fixed, full-screen, transparent, behind the page,
 * never remounted. It draws the booth into the stage rect and the proof-strip
 * planes into their image rects, on demand, from the page's single clock.
 */
export default function BoothCanvas({ onReady }: { onReady: () => void }) {
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
      plinths: lineup.map((w) => ({
        slug: w.slug,
        position: [LAYOUT.x[w.slug], STAGING[w.slug].plinth.h / 2, LAYOUT.z[w.slug]],
        size: STAGING[w.slug].plinth,
        objectBase: [LAYOUT.x[w.slug], STAGING[w.slug].plinth.h, LAYOUT.z[w.slug]],
        objectSize: STAGING[w.slug].object,
      })),
      props: PROPS,
    });
  }, []);

  const perf = perfInfo();

  return (
    <Canvas
      frameloop="never"
      shadows="variance"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, perf.dprCap) : 1}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV, position: [0, 0.4, 5] }}
      events={stageEvents}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <ClockBridge onReady={onReady} />
      <SizeProbe />
      <CameraRig />
      <LampRig />
      <BoothRoom />
      {lineup.map((w) => (
        <ObjectSlot key={w.slug} work={w} />
      ))}
      <Suspense fallback={null}>
        <CalibrationProps />
      </Suspense>
      <ProofLayer />
      <Post />
      <PerfProbe readout={typeof window !== 'undefined' && window.location.search.includes('perf')} />
    </Canvas>
  );
}
