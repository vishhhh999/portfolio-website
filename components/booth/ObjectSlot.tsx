'use client';

import { perfOff } from '@/lib/perfFlags';

import { ContactShadows, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimationMixer, LoopOnce, Box3, BufferGeometry, ExtrudeGeometry, Shape, Color, FrontSide, Matrix4, Mesh, MeshStandardMaterial, Vector3, type AnimationAction, type Camera, type Group, type Material, type Object3D } from 'three';
import type { Work } from '@/lib/types';
import { isMobileTier } from '@/lib/perfTier';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { baseFor, baseMaterial, ContactBlob } from './BoothRoom';
import { loadModel } from './models';
import { attachScreen } from './deviceScreen';
import { PLINTH_GREY, RECEDE_DZ, STAGING, TRAY } from './staging';
import { applyUV, blankInk, createProofInk } from './uvMaterial';
import { hoverFocus, setFocusRect } from './focus';
import { playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { openProject, warmProject } from '@/lib/navigate';
import { DRAG_PX, RAD_PER_PX, onSpin, setSpinDragging, spinDragging, spinOf } from '@/lib/spin';

declare global {
  interface Window {
    /** Test hook: hold every animated object at this clip progress (0–1); undefined = live. */
    __boothAnimHold?: number;
  }
}

const _v = new Vector3();
/** drei Html places labels in canvas space; the booth camera's projection spans the canvas too. */
function stagePosition(el: Object3D, camera: Camera, size: { width: number; height: number }): [number, number] {
  _v.setFromMatrixPosition(el.matrixWorld).project(camera);
  return [((_v.x + 1) / 2) * size.width, ((1 - _v.y) / 2) * size.height];
}

/** The clipped, fixed layer the spec chips render into (see .booth-canvas in globals.css). */
const htmlLayer = {
  get current() {
    return (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.booth-canvas') : null) as HTMLElement;
  },
};

let wedgeMat: MeshStandardMaterial | null = null;
/** The Bengal set's wedge: the same matte N8 as the plinths. */
const wedgeMaterial = () => (wedgeMat ??= new MeshStandardMaterial({ color: PLINTH_GREY, roughness: 0.9, envMapIntensity: 0.4 }));
/** SHUNYA's backing board: matte N3.5, so the white pieces on the clear riser read against it. */
let backingMat: MeshStandardMaterial | null = null;
const backingMaterial = () => (backingMat ??= new MeshStandardMaterial({ color: '#4A4A48', roughness: 0.92, envMapIntensity: 0.3 }));

/** How dark the lineup gets while another sample is on the tray. */
const RECEDE_DIM = 0.9;
/** Hover: lift 4mm over ~120ms (critically damped, no bounce). */
const LIFT = 0.004;

/** The approved UV notes as ink on an object's front, projected along +z in object space. */
function objectInk(work: Work, w: number, h: number) {
  if (!work.uvNotes.length) return { map: blankInk(), box: [0, 0, 1, 1] as [number, number, number, number] };
  const box: [number, number, number, number] = [-w / 2, 0, w / 2, h];
  const at = work.uvNotes.map((n) => ({ text: n.text, at: [(n.anchor[0] - box[0]) / (box[2] - box[0]), 1 - (n.anchor[1] - box[1]) / (box[3] - box[1])] as [number, number] }));
  return { map: createProofInk(at, w / h), box };
}

/**
 * A GLB booth object (tools/optimize-models.mjs output): real-world metres, origin at its base
 * centre, front +Z. Cloned per slot; every material gets the UV chunk (paper whites fluoresce,
 * approved notes print as ink across the front) and casts/receives shadows.
 */
function ModelObject({ work, onReady }: { work: Work; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [root, setRoot] = useState<Object3D | null>(null);
  const [wedge, setWedge] = useState<BufferGeometry | null>(null);
  const m = work.model!;
  const anim = useRef<{ mixer: AnimationMixer; action: AnimationAction; duration: number; p: number } | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    let live = true;
    let detachScreen = () => {};
    // H4: the tray object first on a project page (the rest when idle); on home, left to right
    const active = useBooth.getState().activeSlug;
    const rank = Object.keys(STAGING).sort((a, b) => STAGING[a].x - STAGING[b].x).indexOf(work.slug);
    const priority = active === work.slug ? 0 : active ? 10 + rank : 1 + rank;
    loadModel(isMobileTier() ? m.mobile : m.src, gl, priority)
      .then((gltf) => {
        if (!live) return;
        const scene = gltf.scene.clone(true);
        if (m.layout) {
          // F3: move each named piece so its footprint centre lands on the layout's [x, z], turned by yaw
          scene.updateMatrixWorld(true);
          for (const [name, [lx, lz, yaw]] of Object.entries(m.layout)) {
            const node = scene.getObjectByName(name);
            if (!node) continue;
            node.rotation.y += yaw;
            node.updateMatrixWorld(true);
            const c = new Box3().setFromObject(node).getCenter(new Vector3());
            node.position.x += lx - c.x;
            node.position.z += lz - c.z;
          }
        }
        const st = STAGING[work.slug];
        const real = { w: st.object.w / (st.scale ?? 1), h: st.object.h / (st.scale ?? 1) };
        const ink = objectInk(work, real.w, real.h);
        scene.updateMatrixWorld(true);
        const toRoot = new Matrix4();
        scene.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = mesh.receiveShadow = true;
          // a material per mesh (the ink matrix is per mesh), shared textures untouched
          const mat = (mesh.material as Material).clone() as MeshStandardMaterial;
          if (m.frontSide) mat.side = FrontSide;
          mat.envMapIntensity = 0.8;
          toRoot.copy(mesh.matrixWorld);
          applyUV(mat, { fluorFromBase: true, inkProj: { ...ink, space: toRoot.clone() } });
          mesh.material = mat;
        });
        // A3: a device's display (the brand logo on its colour, an area light the size of the display)
        if (m.screen) detachScreen = attachScreen(scene, work.slug, m.screen.aspect, isMobileTier());
        // A5: the one animated object. The clip is held at its first frame (closed) in the booth
        if (m.animation) {
          const clip = gltf.animations.find((c) => c.name === m.animation) ?? gltf.animations[0];
          if (clip) {
            const mixer = new AnimationMixer(scene);
            const action = mixer.clipAction(clip);
            action.setLoop(LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();
            action.paused = true;
            action.time = 0;
            mixer.update(0);
            anim.current = { mixer, action, duration: clip.duration, p: 0 };
          }
        }
        // B3: a flat set stands on its own sloped wedge, cut to the model's tilt (its bottom plane)
        if (m.stand === 'wedge') {
          const bb = new Box3().setFromObject(scene);
          const t = m.rotation?.[0] ?? 0, off = m.plinthOffset ?? 0;
          const yAt = (zz: number) => Math.max(0.004, off - zz * Math.sin(t) - 0.0015);
          const zf = bb.max.z * Math.cos(t), zb = bb.min.z * Math.cos(t);
          const shape = new Shape();
          shape.moveTo(zf, 0);
          shape.lineTo(zf, yAt(bb.max.z));
          shape.lineTo(zb, yAt(bb.min.z));
          shape.lineTo(zb, 0);
          shape.closePath();
          const width = (bb.max.x - bb.min.x) * 0.86;
          const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
          // the shape is drawn in (z, y): turn it so the extrusion runs along x, centred
          g.rotateY(-Math.PI / 2);
          g.translate(width / 2, 0, 0);
          g.computeVertexNormals();
          setWedge(g);
        }
        setRoot(scene);
        invalidate();
        onReady();
      })
      .catch(() => {});
    return () => {
      live = false;
      detachScreen();
      anim.current = null;
    };
  }, [gl, m, work, invalidate, onReady]);

  // A5: on the tray the clip plays to its end over 900ms (eased in and out); off the tray, back.
  useFrame((_, rawDt) => {
    const a = anim.current;
    if (!a) return;
    const dt = Math.min(0.1, Math.max(0, rawDt || 0));
    // test hook (tools/shots-07.mjs): hold the clip at a fixed progress for a frame-exact sheet
    const hold = typeof window !== 'undefined' ? window.__boothAnimHold : undefined;
    if (typeof hold === 'number') {
      if (a.p !== hold) {
        a.p = hold;
        const eh = a.p < 0.5 ? 4 * a.p ** 3 : 1 - (-2 * a.p + 2) ** 3 / 2;
        a.action.time = eh * a.duration;
        a.mixer.update(0);
        invalidate();
      }
      return;
    }
    const goal = useBooth.getState().activeSlug === work.slug ? 1 : 0;
    if (a.p === goal) return;
    a.p = reduced ? goal : goal > a.p ? Math.min(goal, a.p + dt / 0.9) : Math.max(goal, a.p - dt / 0.9);
    const e = a.p < 0.5 ? 4 * a.p ** 3 : 1 - (-2 * a.p + 2) ** 3 / 2;
    a.action.time = e * a.duration;
    a.mixer.update(0);
    invalidate();
  });
  if (!root) return null;
  return (
    <>
      <primitive object={root} rotation={m.rotation ?? [0, 0, 0]} position={[0, m.plinthOffset ?? 0, 0]} />
      {wedge && <mesh geometry={wedge} material={wedgeMaterial()} castShadow receiveShadow />}
    </>
  );
}

/**
 * One sample in the lineup: its base (plinth, riser or tray) and the object standing on it.
 * Active → the object moves off its base onto the proofing tray.
 * Another active → base and object step back and fall into shadow.
 * Motion is critically damped: on rails, no overshoot.
 */
export function ObjectSlot({ work, lineup }: { work: Work; lineup: string[] }) {
  const slotRef = useRef<Group>(null);
  const objRef = useRef<Group>(null);
  const liftRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const wasSpinning = useRef(false);
  const [shadowKey, setShadowKey] = useState(0);
  const router = useRouter();
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const lamp = useBooth((s) => s.lamp);
  const reduced = useReducedMotion();
  const mobile = isMobileTier();
  const [hovered, setHovered] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const onModelReady = useCallback(() => setModelReady(true), []);

  const st = STAGING[work.slug];
  const { object, base, x, z } = st;
  const active = activeSlug === work.slug;
  const receded = activeSlug !== null && !active;
  const basePart = useMemo(() => baseFor(lineup, work.slug), [lineup, work.slug]);
  const baseMat = useMemo(() => baseMaterial(base.kind, mobile) as MeshStandardMaterial, [base.kind, mobile]);
  const baseColor = useMemo(() => baseMat.color.clone(), [baseMat]);

  type Dimmable = { mat: MeshStandardMaterial; base: Color };
  const objMats = useRef<Dimmable[]>([]);
  const screenMats = useRef<MeshStandardMaterial[]>([]);
  const hoverMats = useRef<Material[]>([]);
  const dim = useRef({ obj: 0, base: 0, lift: 0 });

  // collect the object's materials (again once a GLB arrives)
  useLayoutEffect(() => {
    const objs: Dimmable[] = [];
    const screensHere: MeshStandardMaterial[] = [];
    const hov: Material[] = [];
    liftRef.current?.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
      for (const mt of mats) {
        if (mt.userData.uv) hov.push(mt);
        if (!(mt instanceof MeshStandardMaterial)) continue;
        // screens dim through their emissive level (the rig reads userData.dim), not their colour
        if (mt.emissiveMap) screensHere.push(mt);
        else objs.push({ mat: mt, base: mt.color.clone() });
      }
    });
    objMats.current = objs;
    screenMats.current = screensHere;
    hoverMats.current = hov;
    invalidate();
  }, [modelReady, invalidate]);

  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const box = useMemo(() => ({ v: new Vector3(), corners: [-1, 1].flatMap((sx) => [0, 1].flatMap((sy) => [-1, 1].map((sz) => [sx, sy, sz] as const))) }), []);
  useEffect(() => () => setFocusRect(work.slug, null), [work.slug]);
  useEffect(() => onSpin(() => invalidate()), [invalidate]);

  useFrame((_, rawDt) => {
    // a non-monotonic or stalled clock never jumps or inverts the motion: 0 ≤ dt ≤ 100ms
    const dt = Math.min(0.1, Math.max(0, rawDt || 0));
    const slot = slotRef.current;
    const obj = objRef.current;
    const lift = liftRef.current;
    if (!slot || !obj || !lift) return;
    // on rails: ~95% of the way in 0.65s (the camera's dolly takes ~0.7s)
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4.6);

    const slotZ = z + (activeSlug !== null ? RECEDE_DZ : 0);
    slot.position.z += (slotZ - slot.position.z) * k;

    // Object: on its base (slot space) or on the tray (world space, converted to slot space).
    const tx = active ? -x : 0;
    const ty = active ? TRAY.top : base.h;
    const tz = active ? TRAY.z - slot.position.z : 0;
    obj.position.x += (tx - obj.position.x) * k;
    obj.position.y += (ty - obj.position.y) * k;
    obj.position.z += (tz - obj.position.z) * k;

    // hover lift: ~120ms to settle (rate 25/s), rim highlight with it; none under reduced motion
    const d = dim.current;
    const keyed = useBooth.getState().keySlug === work.slug;
    const liftGoal = (hovered || keyed) && activeSlug === null ? 1 : 0;
    d.lift = reduced ? liftGoal : d.lift + (liftGoal - d.lift) * (1 - Math.exp(-dt * 25));
    if (Math.abs(liftGoal - d.lift) < 1e-3) d.lift = liftGoal;
    lift.position.y = (reduced ? 0 : LIFT) * d.lift;
    for (const mt of hoverMats.current) (mt.userData.uv as { uHover: { value: number } }).uHover.value = d.lift;

    // Behind the tray the row falls into shadow: objects, their screens, and every base (the active one's too).
    const td = receded ? RECEDE_DIM : 0;
    const tp = activeSlug !== null ? RECEDE_DIM * 0.85 : 0;
    d.obj += (td - d.obj) * k;
    d.base += (tp - d.base) * k;
    for (const { mat, base: c } of objMats.current) mat.color.copy(c).multiplyScalar(1 - d.obj);
    baseMat.color.copy(baseColor).multiplyScalar(1 - d.base);
    for (const mt of screenMats.current) mt.userData.dim = d.obj;

    // Tray shot: front-tier neighbours sit between the camera and the tray. Once dimmed (mid-move),
    // they and every front-tier base drop out; the dimmed back tiers stay as context.
    if (z > 0.2) {
      const hideBase = activeSlug !== null && d.base > 0.35;
      for (const c of slot.children) if (c !== obj) c.visible = !hideBase;
      obj.visible = !(receded && d.obj > 0.45);
    }

    // I: the turntable. Drag sets the yaw directly; on release it coasts and damps (none under
    // reduced motion); the keyboard eases to a 15° step. Only this object's own group turns.
    const sp = spinOf(work.slug);
    let spinning = false;
    if (spinDragging() !== work.slug) {
      if (sp.target !== null) {
        sp.yaw = reduced ? sp.target : sp.yaw + (sp.target - sp.yaw) * (1 - Math.exp(-dt * 12));
        if (Math.abs(sp.target - sp.yaw) < 1e-3) (sp.yaw = sp.target), (sp.target = null);
        else spinning = true;
      } else if (sp.v !== 0) {
        sp.yaw += sp.v * dt;
        sp.v *= Math.exp(-dt * 3.2);
        if (Math.abs(sp.v) < 0.03) sp.v = 0;
        spinning = true;
      }
    }
    if (spinRef.current && spinRef.current.rotation.y !== sp.yaw) {
      spinRef.current.rotation.y = sp.yaw;
      spinning = true;
    }

    // the contact shadow is baked once: re-bake it when a turn comes to rest
    if (wasSpinning.current && !spinning && spinDragging() !== work.slug) setShadowKey((k) => k + 1);
    wasSpinning.current = spinning || spinDragging() === work.slug;

    const moving =
      spinning ||
      Math.abs(slotZ - slot.position.z) > 1e-4 ||
      Math.abs(tx - obj.position.x) + Math.abs(ty - obj.position.y) + Math.abs(tz - obj.position.z) > 1e-4 ||
      Math.abs(td - d.obj) > 1e-3 ||
      Math.abs(tp - d.base) > 1e-3 ||
      Math.abs(liftGoal - d.lift) > 1e-3;
    if (moving) invalidate();

    // where this object is on screen: the keyboard layer's focusable button (home lineup only), and
    // B4: a sample is pickable only with ≥ 60% of its projected box inside the view
    let pick = obj.visible;
    if (obj.visible) {
      obj.updateWorldMatrix(true, false);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [sx, sy, sz] of box.corners) {
        box.v.set((sx * object.w) / 2, sy * object.h, (sz * object.d) / 2).applyMatrix4(obj.matrixWorld).project(camera);
        const px = ((box.v.x + 1) / 2) * size.width, py = ((1 - box.v.y) / 2) * size.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      const r = window.__boothStageRect?.();
      if (r) {
        const ix = Math.max(0, Math.min(x1, r.right) - Math.max(x0, r.left));
        const iy = Math.max(0, Math.min(y1, r.bottom) - Math.max(y0, r.top));
        pick = (ix * iy) / Math.max(1, (x1 - x0) * (y1 - y0)) >= 0.6;
      }
      if (activeSlug === null) setFocusRect(work.slug, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      else setFocusRect(work.slug, null);
    } else setFocusRect(work.slug, null);
    slot.userData.pickable = pick;
    if (!pick && hovered) {
      setHovered(false);
      document.body.style.cursor = '';
    }
  });

  const keySlug = useBooth((st) => st.keySlug);
  const showPlate = (hovered || keySlug === work.slug) && activeSlug === null;

  return (
    <group
      ref={slotRef}
      userData={{ slug: work.slug }}
      position={[x, 0, z]}
      onPointerDown={(e) => {
        // I: press and drag turns the object (phones: only the one on the project tray)
        if (!work.model || (mobile && !active) || e.button !== 0) return;
        e.stopPropagation();
        const sp = spinOf(work.slug);
        let last = e.nativeEvent.clientX, travel = 0, t = performance.now();
        sp.target = null;
        sp.v = 0;
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - last;
          last = ev.clientX;
          travel += Math.abs(dx);
          if (travel < DRAG_PX) return;
          setSpinDragging(work.slug);
          const now = performance.now();
          const step = dx * RAD_PER_PX;
          sp.yaw += step;
          const dtm = Math.max(8, now - t) / 1000;
          sp.v = sp.v * 0.6 + (step / dtm) * 0.4;
          t = now;
          invalidate();
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          if (spinDragging() === work.slug) {
            // a pause before letting go leaves nothing to coast on
            if (reduced || performance.now() - t > 90) sp.v = 0;
            setSpinDragging(null);
            invalidate();
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta >= DRAG_PX) return; // a drag (turning the object) or a swipe, not a tap on this sample
        if (active) return;
        playEvent('select', e.nativeEvent.clientX);
        track('Project opened', { slug: work.slug, from: 'booth' });
        openProject(router, `/work/${work.slug}`);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!hovered && activeSlug === null) playEvent('hover', e.nativeEvent.clientX);
        if (!active) warmProject(router, work.slug);
        setHovered(true);
        hoverFocus.slug = work.slug;
        document.body.style.cursor = active ? '' : 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        if (hoverFocus.slug === work.slug) hoverFocus.slug = null;
        document.body.style.cursor = '';
      }}
    >
      {basePart && <mesh geometry={basePart.geometry} material={baseMat} position={[0, base.h / 2, 0]} userData={{ part: true }} castShadow receiveShadow />}
      <ContactBlob w={base.w} d={base.d} spread={1.18} />
      {st.backing && (
        // B3: a dark board standing just behind the riser, leaning back a little
        <mesh position={[0, st.backing.h / 2, -base.d / 2 - 0.012]} rotation={[-0.08, 0, 0]} material={backingMaterial()} userData={{ part: true }} castShadow receiveShadow>
          <boxGeometry args={[st.backing.w, st.backing.h, 0.008]} />
        </mesh>
      )}
      <group ref={objRef} position={[0, base.h, 0]}>
        {/* the object's own contact shadow, rendered once (it moves with the object) */}
        {!perfOff('contact') && <ContactShadows
          key={`${modelReady ? 'ready' : 'wait'}-${lamp}-${shadowKey}`}
          frames={3}
          position={[0, 0.001, 0]}
          scale={[object.w * 1.5, object.d * 1.6]}
          resolution={mobile ? 256 : 512}
          far={Math.max(0.05, object.h * 0.6)}
          blur={2.2}
          opacity={0.55}
          color="#1a1a19"
        />}
        {/* B4: only the object itself and its base pick (never its shadows on the floor) */}
        <group ref={liftRef} userData={{ part: true }}>
          <group ref={spinRef}>
            <group scale={st.scale ?? 1}>
              {work.model && <ModelObject work={work} onReady={onModelReady} />}
            </group>
          </group>
        </group>
        {/* portalled into the fixed, clipped canvas layer: drei defaults to the event source (body), where chips widen the page */}
        <Html portal={htmlLayer} position={[0, object.h + 0.025, 0]} center zIndexRange={[5, 0]} calculatePosition={stagePosition} style={{ pointerEvents: 'none' }}>
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
