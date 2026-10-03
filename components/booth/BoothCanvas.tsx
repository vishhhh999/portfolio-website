'use client';

import { advance, Canvas, events as createPointerEvents, useFrame, useThree, type RootState } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
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
import { Post } from './Post';
import { ProofLayer } from './ProofLayer';
import { lineupShot, trayShot } from './shots';
import { BOOTH, FOCAL_MM, FOV, PLINTH_CHAMFER, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY, lineupLayout } from './staging';

declare global {
  interface Window {
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

  const coarse = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  return (
    <Canvas
      frameloop="never"
      shadows="variance"
      dpr={[1, coarse ? 1.5 : 1.75]}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV, position: [0, 0.4, 5] }}
      events={stageEvents}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <ClockBridge onReady={onReady} />
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
      {typeof window !== 'undefined' && window.location.search.includes('perf') && <PerfProbe />}
    </Canvas>
  );
}
