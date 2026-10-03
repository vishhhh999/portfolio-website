'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { lineup } from '@/content/work';
import { lampById } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { BoothRoom, BOOTH_GREY, CalibrationProps } from './BoothRoom';
import { CameraRig } from './CameraRig';
import { LampRig } from './LampRig';
import { ObjectSlot } from './ObjectSlot';
import { PerfProbe } from './PerfProbe';
import { Post } from './Post';
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

/**
 * The one and only canvas. Lives in the root layout and is never remounted
 * across routes. Render loop: paused when hidden, on demand when still,
 * continuous only for lamps that need it (video, grain, hand lamp).
 */
export default function BoothCanvas({ active }: { active: boolean }) {
  const lamp = useBooth((s) => s.lamp);
  const continuous = lampById(lamp).continuous;

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

  return (
    <Canvas
      frameloop={!active ? 'never' : continuous ? 'always' : 'demand'}
      shadows="variance"
      dpr={[1, typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 1.5 : 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV, position: [0, 0.4, 7] }}
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <color attach="background" args={[BOOTH_GREY]} />
      <CameraRig />
      <BoothRoom />
      {lineup.map((w) => (
        <ObjectSlot key={w.slug} work={w} />
      ))}
      <Suspense fallback={null}>
        <LampRig />
        <CalibrationProps />
      </Suspense>
      <Post />
      {typeof window !== 'undefined' && window.location.search.includes('perf') && <PerfProbe />}
    </Canvas>
  );
}
