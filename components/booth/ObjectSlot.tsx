'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { Color, Mesh, MeshStandardMaterial, type Group } from 'three';
import type { Work } from '@/lib/types';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { LINEUP_X, RECEDE_Z, TRAY_Z, objectSize } from './layout';
import { PLACEHOLDERS } from './placeholders';

/** How dark the lineup gets while another object is on the tray. */
const RECEDE_DIM = 0.8;

/**
 * One object on the booth floor.
 * Lineup → tray when active; steps back and falls into shadow when another is active.
 * Motion is critically damped: on rails, no overshoot.
 */
export function ObjectSlot({ work }: { work: Work }) {
  const ref = useRef<Group>(null);
  const router = useRouter();
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const active = activeSlug === work.slug;
  const receded = activeSlug !== null && !active;
  const homeX = LINEUP_X[work.slug] ?? 0;
  const { height } = objectSize(work.slug);

  const mats = useRef<{ mat: MeshStandardMaterial; base: Color }[]>([]);
  const dim = useRef(0);

  useLayoutEffect(() => {
    const list: typeof mats.current = [];
    ref.current?.traverse((o) => {
      if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {
        list.push({ mat: o.material, base: o.material.color.clone() });
      }
    });
    mats.current = list;
  }, []);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const tx = active ? 0 : homeX;
    const tz = active ? TRAY_Z : receded ? RECEDE_Z : 0;
    const td = receded ? RECEDE_DIM : 0;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5);

    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
    dim.current += (td - dim.current) * k;
    for (const { mat, base } of mats.current) mat.color.copy(base).multiplyScalar(1 - dim.current);

    if (Math.abs(tx - g.position.x) > 1e-4 || Math.abs(tz - g.position.z) > 1e-4 || Math.abs(td - dim.current) > 1e-3) {
      invalidate();
    }
  });

  const showPlate = hovered && activeSlug === null;

  return (
    <group
      ref={ref}
      position={[homeX, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (!active) router.push(`/work/${work.slug}`, { scroll: false });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = active ? '' : 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      {PLACEHOLDERS[work.slug]?.render()}
      <Html position={[0, height + 0.03, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="specchip" data-visible={showPlate}>
          <span className="specchip__title">{work.title}</span>
          <span className="specchip__meta">
            {work.disciplines.join(' · ')} · {work.year}
          </span>
        </div>
      </Html>
    </group>
  );
}
