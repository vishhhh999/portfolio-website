'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { MathUtils, type Group } from 'three';
import { useBooth } from '@/lib/store';
import { kick } from './activity';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, type Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TRIM, type Layout } from './composition';
import { patch } from './materials';

/** Munsell N7 interior, N8 risers, a light instrument-grey case. */
export const COLOURS = { wall: '#a6a5a1', riser: '#bdbcb8', case: '#d6d4ce', caseEdge: '#1d1d1c', tray: '#2b2b2a' } as const;

/**
 * The floor and back wall as one continuous photographic sweep: flat floor from the opening back,
 * a large cove, then up the wall. Extruded across the room's width.
 */
function sweepGeometry(w: number, h: number, d: number, r: number) {
  const prof: [number, number][] = [];
  const back = -d / 2;
  prof.push([d / 2, 0]);
  prof.push([back + r, 0]);
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    prof.push([back + r - Math.sin(a) * r, r - Math.cos(a) * r]);
  }
  prof.push([back, r]);
  prof.push([back, h]);
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i < prof.length; i++) {
    const [z, y] = prof[i];
    // normal: perpendicular to the profile, pointing into the room
    const [za, ya] = prof[Math.max(0, i - 1)], [zb, yb] = prof[Math.min(prof.length - 1, i + 1)];
    let nz = -(yb - ya), ny = zb - za;
    const l = Math.hypot(nz, ny) || 1;
    nz /= l; ny /= l;
    if (ny < 0 || (Math.abs(ny) < 1e-6 && nz < 0)) { nz = -nz; ny = -ny; }
    pos.push(-w / 2, y, z, w / 2, y, z);
    nor.push(0, ny, nz, 0, ny, nz);
  }
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, e = a + 3;
    idx.push(a, b, c, b, e, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function mat(colour: string, roughness: number, metalness = 0) {
  const m = new MeshStandardMaterial({ color: new Color(colour), roughness, metalness, envMapIntensity: 0.6 });
  patch(m, 0.35);
  return m;
}

export const diffuserMaterial = new MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveIntensity: 1, roughness: 1 });

export function Room({ layout }: { layout: Layout }) {
  const { w, h, d } = layout.room;
  const m = useMemo(() => ({ wall: mat(COLOURS.wall, 0.94), floor: Object.assign(mat(COLOURS.wall, 0.82), { side: DoubleSide }), riser: mat(COLOURS.riser, 0.78), case: Object.assign(mat(COLOURS.case, 0.55), { emissive: new Color(COLOURS.case), emissiveIntensity: 0.55 }), edge: mat(COLOURS.caseEdge, 0.5), tray: mat(COLOURS.tray, 0.38, 0.1) }), []);
  const sweep = useMemo(() => sweepGeometry(w, h, d, Math.min(0.14, h * 0.15)), [w, h, d]);
  const recv = (o: Mesh | null) => o && ((o.receiveShadow = true), (o.castShadow = false));
  const ft = d / 2;
  return (
    <group>
      <mesh ref={recv} geometry={sweep} material={m.floor} />
      {/* side walls and ceiling: faces into the room */}
      <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={m.wall}>
        <planeGeometry args={[d, h]} />
      </mesh>
      <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={m.wall}>
        <planeGeometry args={[d, h]} />
      </mesh>
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.wall}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {/* the diffuser: the ceiling's light panel, glowing with the lamp */}
      <mesh position={[0, h - 0.002, -0.04]} rotation={[Math.PI / 2, 0, 0]} material={diffuserMaterial}>
        <planeGeometry args={[w - 0.16, d - 0.24]} />
      </mesh>
      {/* risers and shelves */}
      {layout.risers.map((r, i) => (
        <mesh key={i} position={[r.x, r.h / 2, r.z]} material={m.riser} castShadow receiveShadow geometry={roundedBox(r.w - 0.002, r.h, r.d, 0.004)} />
      ))}
      {/* the presentation tray, front centre: it rises when a project's object comes forward */}
      <Tray layout={layout} material={m.tray} />
      {/* the case: a thin light frame around the opening, a fine dark line on its inner edge */}
      <group position={[0, 0, ft]}>
        <mesh material={m.case} position={[-w / 2 - TRIM.side / 2, h / 2, -TRIM.depth / 2]} geometry={roundedBox(TRIM.side, h + TRIM.top + TRIM.bottom, TRIM.depth, 0.004)} />
        <mesh material={m.case} position={[w / 2 + TRIM.side / 2, h / 2, -TRIM.depth / 2]} geometry={roundedBox(TRIM.side, h + TRIM.top + TRIM.bottom, TRIM.depth, 0.004)} />
        <mesh material={m.case} position={[0, h + TRIM.top / 2, -TRIM.depth / 2]} geometry={roundedBox(w + 2 * TRIM.side, TRIM.top, TRIM.depth, 0.004)} />
        <mesh material={m.case} position={[0, -TRIM.bottom / 2, -TRIM.depth / 2]} geometry={roundedBox(w + 2 * TRIM.side, TRIM.bottom, TRIM.depth, 0.004)} />
        <mesh material={m.edge} position={[0, h + 0.0015, 0.0005]}>
          <boxGeometry args={[w, 0.003, 0.002]} />
        </mesh>
        <mesh material={m.edge} position={[-w / 2 - 0.0015, h / 2, 0.0005]}>
          <boxGeometry args={[0.003, h, 0.002]} />
        </mesh>
        <mesh material={m.edge} position={[w / 2 + 0.0015, h / 2, 0.0005]}>
          <boxGeometry args={[0.003, h, 0.002]} />
        </mesh>
      </group>
    </group>
  );
}

function Tray({ layout, material }: { layout: Layout; material: MeshStandardMaterial }) {
  const g = useRef<Group>(null!);
  const v = useRef(-1);
  useFrame((_, dt) => {
    const want = useBooth.getState().activeSlug ? 1 : 0;
    v.current = v.current < 0 ? want : MathUtils.damp(v.current, want, 7, dt);
    if (Math.abs(v.current - want) > 0.002) kick(32);
    else v.current = want;
    g.current.visible = v.current > 0.01;
    g.current.scale.set(0.6 + 0.4 * v.current, Math.max(0.001, v.current), 0.6 + 0.4 * v.current);
  });
  return (
    <group ref={g} position={[layout.tray.x, 0, layout.tray.z]}>
      <mesh position={[0, layout.tray.h / 2, 0]} material={material} castShadow receiveShadow>
        <cylinderGeometry args={[layout.tray.r, layout.tray.r * 1.02, layout.tray.h, 96]} />
      </mesh>
    </group>
  );
}

const boxes = new Map<string, RoundedBoxGeometry>();
function roundedBox(w: number, h: number, d: number, r: number) {
  const k = [w, h, d, r].map((v) => v.toFixed(4)).join(',');
  let g = boxes.get(k);
  if (!g) boxes.set(k, (g = new RoundedBoxGeometry(w, h, d, 3, r)));
  return g;
}
