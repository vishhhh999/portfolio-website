'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import type { Group } from 'three';
import type { Work } from '@/lib/types';
import { useBooth } from '@/lib/store';
import { LINEUP_X, TRAY_Z } from './layout';
import { PLACEHOLDERS } from './placeholders';

/**
 * One object on the booth floor. Slides onto the tray when it's the active slug.
 * Motion is a critically damped approach (no springs, no overshoot) — "on rails".
 */
export function ObjectSlot({ work }: { work: Work }) {
  const ref = useRef<Group>(null);
  const router = useRouter();
  const invalidate = useThree((s) => s.invalidate);
  const active = useBooth((s) => s.activeSlug === work.slug);
  const homeX = LINEUP_X[work.slug] ?? 0;

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const tx = active ? 0 : homeX;
    const tz = active ? TRAY_Z : 0;
    const k = 1 - Math.exp(-dt * 7);
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
    if (Math.abs(tx - g.position.x) > 1e-4 || Math.abs(tz - g.position.z) > 1e-4) invalidate();
  });

  const placeholder = PLACEHOLDERS[work.slug];

  return (
    <group
      ref={ref}
      position={[homeX, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/work/${work.slug}`, { scroll: false });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {placeholder?.render()}
    </group>
  );
}
