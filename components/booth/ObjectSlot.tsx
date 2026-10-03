'use client';

import { Html, RoundedBox } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Group } from 'three';
import type { Work } from '@/lib/types';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { ContactBlob } from './BoothRoom';
import { BoothMat, INK_ASPECT, PLACEHOLDERS } from './placeholders';
import { PLINTH_CHAMFER, PLINTH_GREY, RECEDE_DZ, STAGING, TRAY } from './staging';
import { createInkTexture } from './uvMaterial';
import { stageRect } from '@/lib/views';
import { Vector3, type Camera, type Object3D } from 'three';

const _v = new Vector3();
/** drei Html places labels in canvas space; the booth draws into the stage rect, so project into that. */
function stagePosition(el: Object3D, camera: Camera): [number, number] {
  const r = stageRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  _v.setFromMatrixPosition(el.matrixWorld).project(camera);
  return [r.left + ((_v.x + 1) / 2) * r.width, r.top + ((1 - _v.y) / 2) * r.height];
}

/** How dark the lineup gets while another sample is on the tray. */
const RECEDE_DIM = 0.9;

/**
 * One sample in the lineup: a plinth and the object propped on it.
 * Active → the object lifts off its plinth onto the proofing tray.
 * Another active → plinth and object step back and fall into shadow.
 * Motion is critically damped: on rails, no overshoot.
 */
export function ObjectSlot({ work }: { work: Work }) {
  const slotRef = useRef<Group>(null);
  const objRef = useRef<Group>(null);
  const router = useRouter();
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const { object, plinth, x, z } = STAGING[work.slug];
  const active = activeSlug === work.slug;
  const receded = activeSlug !== null && !active;

  const inkTex = useMemo(
    () => createInkTexture(work.uvNotes.map((n) => n.text), INK_ASPECT[work.slug] ?? 1, work.slug.length),
    [work],
  );

  type Dimmable = { mat: MeshStandardMaterial; base: Color };
  const objMats = useRef<Dimmable[]>([]);
  const plinthMats = useRef<Dimmable[]>([]);
  const screenMats = useRef<MeshBasicMaterial[]>([]);
  const dim = useRef({ obj: 0, plinth: 0 });

  useLayoutEffect(() => {
    const objs: Dimmable[] = [];
    const screensHere: MeshBasicMaterial[] = [];
    objRef.current?.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      if (o.material instanceof MeshStandardMaterial) objs.push({ mat: o.material, base: o.material.color.clone() });
      if (o.material instanceof MeshBasicMaterial && o.material.map && !o.material.transparent) screensHere.push(o.material);
    });
    objMats.current = objs;
    screenMats.current = screensHere;
    const plinths: Dimmable[] = [];
    slotRef.current?.children.forEach((c) => {
      if (c instanceof Mesh && c.material instanceof MeshStandardMaterial) plinths.push({ mat: c.material, base: c.material.color.clone() });
    });
    plinthMats.current = plinths;
  }, []);

  useFrame((_, dt) => {
    const slot = slotRef.current;
    const obj = objRef.current;
    if (!slot || !obj) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5);

    const slotZ = z + (activeSlug !== null ? RECEDE_DZ : 0);
    slot.position.z += (slotZ - slot.position.z) * k;

    // Object: on its plinth (slot space) or on the tray (world space, converted to slot space).
    const tx = active ? -x : 0;
    const ty = active ? TRAY.top : plinth.h;
    const tz = active ? TRAY.z - slot.position.z : 0;
    obj.position.x += (tx - obj.position.x) * k;
    obj.position.y += (ty - obj.position.y) * k;
    obj.position.z += (tz - obj.position.z) * k;

    // Behind the tray the row falls into shadow: objects, their screens, and every plinth (the active one's too).
    const td = receded ? RECEDE_DIM : 0;
    const tp = activeSlug !== null ? RECEDE_DIM * 0.85 : 0;
    const d = dim.current;
    d.obj += (td - d.obj) * k;
    d.plinth += (tp - d.plinth) * k;
    for (const { mat, base } of objMats.current) mat.color.copy(base).multiplyScalar(1 - d.obj);
    for (const { mat, base } of plinthMats.current) mat.color.copy(base).multiplyScalar(1 - d.plinth);
    for (const m of screenMats.current) m.userData.dim = d.obj;

    const moving =
      Math.abs(slotZ - slot.position.z) > 1e-4 ||
      Math.abs(tx - obj.position.x) + Math.abs(ty - obj.position.y) + Math.abs(tz - obj.position.z) > 1e-4 ||
      Math.abs(td - d.obj) > 1e-3 ||
      Math.abs(tp - d.plinth) > 1e-3;
    if (moving) invalidate();
  });

  const showPlate = hovered && activeSlug === null;

  return (
    <group
      ref={slotRef}
      position={[x, 0, z]}
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
      <RoundedBox
        args={[plinth.w, plinth.h, plinth.d]}
        radius={PLINTH_CHAMFER}
        smoothness={1}
        position={[0, plinth.h / 2, 0]}
        castShadow
        receiveShadow
      >
        <BoothMat color={PLINTH_GREY} roughness={0.92} />
      </RoundedBox>
      <ContactBlob w={plinth.w} d={plinth.d} spread={1.25} />
      <group ref={objRef} position={[0, plinth.h, 0]}>
        <ContactBlob w={object.w} d={Math.min(object.d, plinth.d * 0.8)} spread={1.2} />
        {PLACEHOLDERS[work.slug]?.(inkTex)}
        <Html position={[0, object.h + 0.025, 0]} center zIndexRange={[5, 0]} calculatePosition={stagePosition} style={{ pointerEvents: 'none' }}>
          <div className="specchip" data-visible={showPlate}>
            <span className="specchip__title">{work.title}</span>
            <span className="specchip__meta">
              {work.disciplines.join(' · ')} · {work.year}
            </span>
          </div>
        </Html>
      </group>
    </group>
  );
}
