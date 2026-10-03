'use client';

import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { NeutralToneMapping } from 'three';
import { works } from '@/content/work';
import { BoothRoom, BOOTH_GREY, D50Rig } from './BoothRoom';
import { CameraRig } from './CameraRig';
import { FOV } from './layout';
import { ObjectSlot } from './ObjectSlot';

declare global {
  interface Window {
    __boothMounts?: number;
  }
}

/**
 * The one and only canvas. Lives in the root layout and is never remounted
 * across routes; `active` pauses the render loop when the booth is hidden.
 */
export default function BoothCanvas({ active }: { active: boolean }) {
  useEffect(() => {
    window.__boothMounts = (window.__boothMounts ?? 0) + 1;
  }, []);

  return (
    <Canvas
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 1.5 : 2]}
      gl={{ antialias: true, toneMapping: NeutralToneMapping, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, position: [0, 0.4, 7] }}
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <color attach="background" args={[BOOTH_GREY]} />
      <CameraRig />
      <D50Rig />
      <BoothRoom />
      {works.map((w) => (
        <ObjectSlot key={w.slug} work={w} />
      ))}
    </Canvas>
  );
}
