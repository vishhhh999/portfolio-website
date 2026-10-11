'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimationMixer, Box3, CanvasTexture, ExtrudeGeometry, Group, LoopOnce, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Shape, Vector3, type AnimationAction, type Object3D,
} from 'three';
import type { Work } from '@/lib/types';
import { useBooth } from '@/lib/store';
import { spinOf, spinDragging } from '@/lib/spin';
import { isPhoneTier } from '@/lib/perfTier';
import { kick } from './activity';
import { ease } from './camera';
import { PRESENT, TRAY_PRESENT, type Layout, type Presentation } from './composition';
import { loadModel, track } from './loader';
import { patch, prepareModel, screenMaterial, setHover } from './materials';
import { objects, screenAnchors } from './registry';
import { COLOURS } from './Room';

const MOVE_MS = 720;
const LIFT = 0.012;

/** A soft dark ellipse under every object: the contact term that keeps it on its surface. */
let aoTexture: CanvasTexture | null = null;
function contactTexture() {
  if (aoTexture) return aoTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  aoTexture = new CanvasTexture(c);
  return aoTexture;
}

/** The model placed for a presentation: scaled, turned, leaned, centred on its footprint, base at y 0. */
function present(src: Object3D, p: Presentation, layoutNodes?: Record<string, [number, number, number]>) {
  const model = src.clone(true);
  if (layoutNodes) {
    model.updateMatrixWorld(true);
    for (const [name, [lx, lz, yaw]] of Object.entries(layoutNodes)) {
      const node = model.getObjectByName(name);
      if (!node) continue;
      node.rotation.y += yaw;
      node.updateMatrixWorld(true);
      const c = new Box3().setFromObject(node).getCenter(new Vector3());
      node.position.x += lx - c.x;
      node.position.z += lz - c.z;
    }
  }
  const lean = new Group();
  lean.add(model);
  lean.rotation.set(p.rx ?? 0, p.yaw ?? 0, 0, 'YXZ');
  lean.scale.setScalar(p.scale);
  const holder = new Group();
  holder.add(lean);
  holder.updateMatrixWorld(true);
  const b = new Box3().setFromObject(holder);
  const c = b.getCenter(new Vector3());
  lean.position.set(-c.x, -b.min.y + (p.lift ?? 0), -c.z);
  holder.updateMatrixWorld(true);
  const size = new Box3().setFromObject(holder).getSize(new Vector3());
  return { holder, model, size };
}

/** A sloped block under a flat set, cut to its lean (the set's underside). */
function wedgeFor(size: Vector3, rx: number) {
  const d = size.z, h = Math.max(0.006, size.y - 0.006);
  const shape = new Shape();
  shape.moveTo(d / 2, 0);
  shape.lineTo(d / 2, 0.004);
  shape.lineTo(-d / 2 + 0.004, h * (rx > 0 ? 0.96 : 0.5));
  shape.lineTo(-d / 2 + 0.004, 0);
  shape.closePath();
  const w = size.x * 0.84;
  const g = new ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(w / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

const standMat = new MeshStandardMaterial({ color: COLOURS.riser, roughness: 0.78 });
patch(standMat, 0.35);
const easelMat = new MeshStandardMaterial({ color: '#e9e9e6', roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });

type Built = { holder: Group; size: Vector3; mixer?: AnimationMixer; action?: AnimationAction; wedge?: ExtrudeGeometry };

export function Specimen({ work, layout, index }: { work: Work; layout: Layout; index: number }) {
  const slug = work.slug;
  const m = work.model!;
  const group = useRef<Group>(null!);
  const lift = useRef<Group>(null!);
  const spinG = useRef<Group>(null!);
  const ao = useRef<Mesh>(null!);
  const active = useBooth((s) => s.activeSlug === slug);
  const hovered = useBooth((s) => s.hoverSlug === slug);
  const [built, setBuilt] = useState<Built | null>(null);
  const [detail, setDetail] = useState(false);

  // the light model first (every view needs it); the detailed one when this object is on the tray
  const wantDetail = active && !isPhoneTier();
  const url = wantDetail && detail ? m.src : m.mobile;
  useEffect(() => {
    if (!wantDetail) return;
    let live = true;
    void loadModel(m.src, 0).then(() => live && setDetail(true));
    return () => {
      live = false;
    };
  }, [wantDetail, m.src]);

  const presentation = useMemo<Presentation>(() => ({ ...PRESENT[slug], ...(active ? TRAY_PRESENT[slug] : {}) }), [slug, active]);

  useEffect(() => {
    let live = true;
    const p = loadModel(url, active ? 0 : 1 + index);
    track(p).then((gltf) => {
      if (!live) return;
      const { holder, model, size } = present(gltf.scene, presentation, m.layout);
      prepareModel(model, { slug, frontSide: m.frontSide });
      model.traverse((o) => o.layers.set(1 + index));
      if (m.screen) {
        const node = model.getObjectByName('screen');
        if (node) {
          const s = screenMaterial(slug, m.screen.aspect);
          node.traverse((o) => ((o as Mesh).isMesh ? ((o as Mesh).material = s.material) : null));
          screenAnchors.set(slug, { at: node, colour: s.colour });
        }
      }
      const out: Built = { holder, size };
      if (presentation.stand === 'wedge') out.wedge = wedgeFor(size, presentation.rx ?? 0);
      if (m.animation) {
        const clip = gltf.animations.find((c) => c.name === m.animation) ?? gltf.animations[0];
        if (clip) {
          const mixer = new AnimationMixer(model);
          const action = mixer.clipAction(clip);
          action.setLoop(LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          action.paused = true;
          mixer.setTime(0);
          out.mixer = mixer;
          out.action = action;
        }
      }
      setBuilt(out);
      kick(100);
    });
    return () => {
      live = false;
    };
  }, [url, presentation, slug, index, m]);

  useEffect(() => {
    if (!built) return;
    objects.set(slug, { slug, root: group.current, size: built.size, layer: 1 + index });
    return () => void objects.delete(slug);
  }, [built, slug, index]);

  // slot ↔ tray move, hover lift, turn, book opening: all eased per frame
  const move = useRef({ from: new Vector3(), to: new Vector3(), t0: -1, at: active ? 1 : 0 });
  const home = useMemo(() => new Vector3(layout.slots[slug].x, layout.slots[slug].y, layout.slots[slug].z), [layout, slug]);
  const tray = useMemo(() => new Vector3(layout.tray.x, layout.tray.h, layout.tray.z), [layout]);
  const placed = useRef(false);
  useEffect(() => {
    const g = group.current;
    const target = active ? tray : home;
    if (!placed.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      g.position.copy(target);
      placed.current = true;
      move.current.t0 = -1;
    } else {
      move.current = { from: g.position.clone(), to: target.clone(), t0: performance.now(), at: 0 };
    }
    kick(MOVE_MS + 50);
  }, [active, home, tray]);

  const hoverV = useRef(0);
  const open = useRef(0);
  useEffect(() => {
    kick(400);
  }, [hovered]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const mv = move.current;
    if (mv.t0 >= 0) {
      const t = Math.min(1, (performance.now() - mv.t0) / MOVE_MS);
      const k = ease(t);
      g.position.lerpVectors(mv.from, mv.to, k);
      // a shallow arc: lifted clear of the tray edge mid-move
      g.position.y += Math.sin(Math.PI * k) * 0.03;
      if (t >= 1) mv.t0 = -1;
      else kick(32);
    }
    // hover: lift and rim
    const hv = hovered ? 1 : 0;
    hoverV.current = MathUtils.damp(hoverV.current, hv, 14, dt);
    if (Math.abs(hoverV.current - hv) > 0.002) kick(32);
    lift.current.position.y = hoverV.current * LIFT;
    if (built) setHover(built.holder, hoverV.current);
    if (ao.current) (ao.current.material as MeshBasicMaterial).opacity = 0.5 * (1 - hoverV.current * 0.35);
    // turn (drag, keys) with inertia; faces front again when it leaves the tray
    const s = spinOf(slug);
    if (s.target !== null) {
      s.yaw = MathUtils.damp(s.yaw, s.target, 10, dt);
      if (Math.abs(s.yaw - s.target) < 0.001) (s.yaw = s.target), (s.target = null);
      kick(32);
    } else if (spinDragging() !== slug && Math.abs(s.v) > 0.0005) {
      s.yaw += s.v * dt;
      s.v *= Math.exp(-dt * 4);
      kick(32);
    }
    spinG.current.rotation.y = s.yaw;
    // the book opens on the tray and closes when it leaves
    if (built?.mixer && built.action) {
      const want = active && mv.t0 < 0 ? 1 : 0;
      const prev = open.current;
      open.current = MathUtils.clamp(open.current + (want ? dt : -dt) / 0.9, 0, 1);
      if (open.current !== prev) {
        built.mixer.setTime(ease(open.current) * built.action.getClip().duration);
        kick(32);
      }
    }
  });

  const size = built?.size;
  return (
    <group ref={group} userData={{ slug }}>
      <group ref={lift}>
        <group ref={spinG}>
          {built && <primitive object={built.holder} />}
          {built?.wedge && <mesh geometry={built.wedge} material={standMat} castShadow receiveShadow layers={1 + index} />}
          {size && presentation.stand === 'easel' && (
            <mesh material={easelMat} position={[0, size.y * 0.42, -size.z / 2 - 0.004]} rotation={[-(Math.abs(presentation.rx ?? 0)), 0, 0]} layers={1 + index}>
              <boxGeometry args={[size.x * 0.5, size.y * 0.8, 0.004]} />
            </mesh>
          )}
        </group>
      </group>
      {size && (
        <mesh ref={ao} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0012, 0]} renderOrder={1} layers={1 + index}>
          <planeGeometry args={[size.x * 1.25, size.z * 1.35]} />
          <meshBasicMaterial map={contactTexture()} transparent opacity={0.5} depthWrite={false} color="#000" polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
    </group>
  );
}
