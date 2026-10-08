'use client';

import { perfOff } from '@/lib/perfFlags';

import { ContactShadows, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimationMixer, LoopOnce, Box3, BufferGeometry, CanvasTexture, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, SRGBColorSpace, Shape, Color, FrontSide, Matrix4, Mesh, MeshStandardMaterial, Vector3, type AnimationAction, type Camera, type Group, type Material, type Object3D } from 'three';
import type { Work } from '@/lib/types';
import { isMobileTier } from '@/lib/perfTier';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { baseFor, baseMaterial, ContactBlob } from './BoothRoom';
import { loadModel } from './models';
import { attachScreen } from './deviceScreen';
import { activeLayout, PLINTH_GREY, RECEDE_DZ, STAGING, TRAY } from './staging';
import { useLayoutKey } from './useLayout';
import { trayHidden } from './shots';
import { stageRect } from '@/lib/views';
import { applyUV, blankInk, createProofInk } from './uvMaterial';
import { cursorTarget, focusRects, hoverFocus, setCursorTarget, setFocusRect, tappedRect } from './focus';
import { playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { openProject, warmProject } from '@/lib/navigate';
import { markDirty } from '@/lib/dirty';
import { revealed } from '@/lib/reveal';
import { logEvent } from '@/lib/eventLog';
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
/**
 * E (08): SHUNYA's sweep card: a matte Munsell N5.5 card lying on the riser and curving up behind
 * the pieces (a product-shot cove), so the white pieces read on a mid grey, not on black.
 */
let sweepMat: MeshStandardMaterial | null = null;
const sweepMaterial = () => (sweepMat ??= new MeshStandardMaterial({ color: '#848484', roughness: 0.9, envMapIntensity: 0.35, side: DoubleSide }));
function sweepGeometry(w: number, d: number, h: number, r: number) {
  // profile in (z, y): flat from the front edge, a quarter round, then straight up
  const prof: [number, number][] = [[d / 2, 0]];
  const back = -d / 2 + r;
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    prof.push([back - Math.sin(a) * r, r - Math.cos(a) * r]);
  }
  prof.push([-d / 2, h]);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  prof.forEach(([z, y], i) => {
    pos.push(-w / 2, y, z, w / 2, y, z);
    uv.push(0, i / (prof.length - 1), 1, i / (prof.length - 1));
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * E (08): the scale plate on the tug's plinth: brushed metal, the ratio engraved (dark, Geist Mono).
 */
const PLATE = { w: 0.064, h: 0.024 };
function plateTexture(text: string) {
  const W = 512, H = Math.round((512 * PLATE.h) / PLATE.w);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b9b8b4';
  g.fillRect(0, 0, W, H);
  // brushing: fine horizontal streaks, seeded so every build draws the same plate
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const y = rnd() * H, l = 40 + rnd() * 260, x = rnd() * W - 40;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, y, l, 1);
  }
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() || 'monospace';
  g.font = `500 ${Math.round(H * 0.52)}px ${mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // engraved: a light lower lip under the dark cut
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillText(text, W / 2, H / 2 + 2);
  g.fillStyle = '#26262a';
  g.fillText(text, W / 2, H / 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function Sweep({ w, d, h, r, y }: { w: number; d: number; h: number; r: number; y: number }) {
  const geo = useMemo(() => sweepGeometry(w, d, h, r), [w, d, h, r]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} position={[0, y + 0.0003, 0]} material={sweepMaterial()} userData={{ part: true }} castShadow receiveShadow />;
}
function ScalePlate({ text, z, y }: { text: string; z: number; y: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', metalness: 0.85, roughness: 0.38, envMapIntensity: 0.9 }), []);
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      if (!live) return;
      mat.map = plateTexture(text);
      mat.needsUpdate = true;
      markDirty('plate', undefined, 2);
      invalidate();
    });
    return () => {
      live = false;
      mat.map?.dispose();
    };
  }, [text, mat, invalidate]);
  return (
    <mesh position={[0, y, z]} material={mat} userData={{ part: true }}>
      <boxGeometry args={[PLATE.w, PLATE.h, 0.0012]} />
    </mesh>
  );
}

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
  const fade = useRef<{ t: number; mats: { m: Material; transparent: boolean; opacity: number }[] } | null>(null);
  useFrame((_, rawDt) => {
    const f = fade.current;
    if (!f) return;
    f.t = Math.min(1, f.t + Math.min(0.1, Math.max(0, rawDt || 0)) / 0.25);
    const k = f.t * f.t * (3 - 2 * f.t);
    for (const e of f.mats) e.m.opacity = e.opacity * k;
    if (f.t >= 1) {
      for (const e of f.mats) {
        e.m.transparent = e.transparent;
        e.m.opacity = e.opacity;
      }
      fade.current = null;
      logEvent(`model ${work.slug} faded in`);
    }
    markDirty('model fade', undefined, 1);
    invalidate();
  });
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
        // A5 (09): a model whose origin is not under its middle is centred on its footprint
        if (m.center) {
          scene.updateMatrixWorld(true);
          const c = new Box3().setFromObject(scene).getCenter(new Vector3());
          scene.position.x -= c.x;
          scene.position.z -= c.z;
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
          // F3 (08): artwork is often seen at an angle (the open book, a pouch's side): anisotropic
          // filtering keeps the type sharp where trilinear alone smears it
          const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
          for (const t of [mat.map, mat.emissiveMap]) if (t && t.anisotropy < aniso) (t.anisotropy = aniso), (t.needsUpdate = true);
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
        // C2 (08): a model arriving after the reveal fades in over 250ms instead of popping in
        if (revealed.value) {
          const mats: { m: Material; transparent: boolean; opacity: number }[] = [];
          scene.traverse((o) => {
            const mesh = o as Mesh;
            if (!mesh.isMesh) return;
            for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]) {
              mats.push({ m, transparent: m.transparent, opacity: m.opacity });
              m.transparent = true;
              m.opacity = 0;
            }
          });
          fade.current = { t: 0, mats };
          logEvent(`model ${work.slug} fading in`);
        }
        setRoot(scene);
        markDirty(`model ${work.slug} loaded`, undefined, 3);
        logEvent(`model ${work.slug} loaded`);
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
    markDirty('JSW clip', undefined, 1);
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
  // C5 (08): the contact shadow re-bakes when a turn comes to rest; the old and new bakes crossfade
  // over 200ms (two instances for that moment), never a swap
  const [shadowKeys, setShadowKeys] = useState<number[]>([0]);
  const shadowRefs = useRef(new Map<number, Group>());
  const shadowFade = useRef(0);
  const bakeSeq = useRef(0);
  const router = useRouter();
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();
  const mobile = isMobileTier();
  const [hovered, setHovered] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const onModelReady = useCallback(() => setModelReady(true), []);

  // L2 (09B): the slot re-renders when the arrangement changes (a resize or rotation across a shape)
  const layoutKey = useLayoutKey();
  const st = STAGING[work.slug];
  const { object, base, x, z } = st;
  const y = st.y ?? 0;
  const active = activeSlug === work.slug;
  const receded = activeSlug !== null && !active;
  const basePart = useMemo(() => (base.kind === 'none' ? null : baseFor(lineup, work.slug)), [lineup, work.slug, base.kind, layoutKey]);
  const baseMat = useMemo(() => baseMaterial(base.kind === 'none' ? 'plinth' : base.kind, mobile) as MeshStandardMaterial, [base.kind, mobile, layoutKey]);
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
  // L2 (09B): a new arrangement clears the hover (the object is somewhere else now); its turn is kept
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    setHovered(false);
    if (hoverFocus.slug === work.slug) hoverFocus.slug = null;
    document.body.style.cursor = '';
    markDirty('layout', undefined, 3);
    invalidate();
  }, [layoutKey, work.slug, invalidate]);
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
    const ty = active ? TRAY.top - y : base.h;
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

    // F1 (08): tray shot. Once dimmed (mid-move), a neighbour that would overlap the tray object or be
    // cut by the frame drops out with its base (shots.trayHidden); the rest stay, dimmed and whole.
    {
      const r = stageRect();
      const aspect = r && r.height > 0 ? r.width / r.height : size.width / size.height;
      // the active sample's own base is empty while it is on the tray: it always drops out
      const out = activeSlug !== null && (active || trayHidden(activeSlug, aspect).has(work.slug));
      const hideBase = out && d.base > 0.35;
      for (const c of slot.children) if (c !== obj) c.visible = !hideBase;
      obj.visible = !(out && receded && d.obj > 0.45);
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

    // D (09): while the object turns (dragged or coasting) its contact shadow renders every frame (a
    // live instance, -1); at rest the cached bake returns: a fresh bake crossfades in over 200ms
    const turning = spinning || spinDragging() === work.slug;
    if (turning && !wasSpinning.current) {
      setShadowKeys(() => [-1]);
      logEvent(`contact shadow ${work.slug} live (turning)`);
    }
    if (wasSpinning.current && !turning) {
      shadowFade.current = 0;
      setShadowKeys(() => [-1, ++bakeSeq.current]);
      logEvent(`contact shadow ${work.slug} re-bake (crossfade)`);
    }
    if (shadowKeys.length === 2) {
      shadowFade.current = Math.min(1, shadowFade.current + dt / 0.2);
      const t = shadowFade.current;
      const setOp = (key: number, o: number) => {
        const m = (shadowRefs.current.get(key)?.children[0] as Mesh | undefined)?.material as Material | undefined;
        if (m) m.opacity = o;
      };
      setOp(shadowKeys[0], 0.55 * (1 - t));
      setOp(shadowKeys[1], 0.55 * t);
      invalidate();
      if (t >= 1) setShadowKeys((k) => (k.length === 2 ? [k[1]] : k));
    }
    wasSpinning.current = turning;

    const moving =
      spinning ||
      Math.abs(slotZ - slot.position.z) > 1e-4 ||
      Math.abs(tx - obj.position.x) + Math.abs(ty - obj.position.y) + Math.abs(tz - obj.position.z) > 1e-4 ||
      Math.abs(td - d.obj) > 1e-3 ||
      Math.abs(tp - d.base) > 1e-3 ||
      Math.abs(liftGoal - d.lift) > 1e-3;
    if (moving) {
      invalidate();
      // B1 (08): a sample moving changes the shadow, the reflection and the normals
      markDirty('object moving', undefined, 1);
    }

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
        // L5 (09B): the view is the stage as far as it is on screen (the shelf's stage runs past the first screen)
        const ix = Math.max(0, Math.min(x1, r.right, size.width) - Math.max(x0, r.left, 0));
        const iy = Math.max(0, Math.min(y1, r.bottom, size.height) - Math.max(y0, r.top, 0));
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
      position={[x, y, z]}
      onPointerDown={(e) => {
        // I: press and drag turns the object (phones: only the one on the project tray)
        // L3 (09B): on the shelf a phone turns a sample with a sideways drag too (vertical pans scroll)
        if (!work.model || (mobile && !active && activeLayout().kind !== 'shelf') || e.button !== 0) return;
        e.stopPropagation();
        setCursorTarget(cursorTarget.label, true);
        // L3 (09B): the floating lamp panel keeps clear of the sample a finger is on
        const fr = focusRects.get(work.slug);
        if (e.nativeEvent.pointerType !== 'mouse' && fr) tappedRect.r = { left: fr.x, top: fr.y, right: fr.x + fr.w, bottom: fr.y + fr.h };
        const sp = spinOf(work.slug);
        let last = e.nativeEvent.clientX, travel = 0, t = performance.now();
        const x0 = e.nativeEvent.clientX, y0 = e.nativeEvent.clientY;
        let decided: 'turn' | 'scroll' | null = e.nativeEvent.pointerType === 'mouse' ? 'turn' : null;
        sp.target = null;
        sp.v = 0;
        const move = (ev: PointerEvent) => {
          // touch: the first 8px decide: mostly sideways turns the sample, anything else is the page's scroll
          if (!decided) {
            const ax = Math.abs(ev.clientX - x0), ay = Math.abs(ev.clientY - y0);
            if (Math.max(ax, ay) < 8) return;
            decided = ax > ay ? 'turn' : 'scroll';
            last = ev.clientX;
          }
          if (decided === 'scroll') return;
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
          tappedRect.r = null;
          setCursorTarget(hoverFocus.slug === work.slug && !active ? `Open ${work.title}` : null, false);
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
        if (!cursorTarget.pressed) setCursorTarget(active ? null : `Open ${work.title}`);
        document.body.style.cursor = active ? '' : 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        if (hoverFocus.slug === work.slug) hoverFocus.slug = null;
        if (!cursorTarget.pressed) setCursorTarget(null);
        document.body.style.cursor = '';
      }}
    >
      {basePart && <mesh geometry={basePart.geometry} material={baseMat} position={[0, base.h / 2, 0]} userData={{ part: true }} castShadow receiveShadow />}
      <ContactBlob w={base.w} d={base.d} spread={1.18} />
      {st.sweep && <Sweep w={st.sweep.w} d={base.d} h={st.sweep.h} r={st.sweep.r} y={base.h} />}
      {st.plate && <ScalePlate text={st.plate} z={base.d / 2 + 0.0008} y={base.h * 0.55} />}
      <group ref={objRef} position={[0, base.h, 0]}>
        {/* the object's own contact shadow, rendered once (it moves with the object) */}
        {!perfOff('contact') &&
          shadowKeys.map((sk) => (
            <ContactShadows
          key={`${modelReady ? 'ready' : 'wait'}-${layoutKey}-${sk}`}
          ref={(g: Group | null) => {
            if (g) shadowRefs.current.set(sk, g);
            else shadowRefs.current.delete(sk);
          }}
          frames={sk < 0 ? Infinity : 3}
          position={[0, 0.001, 0]}
          scale={[object.w * 1.5, object.d * 1.6]}
          resolution={mobile ? 256 : 512}
          far={Math.max(0.05, object.h * 0.6)}
          blur={2.2}
          opacity={shadowKeys.length === 2 && sk === shadowKeys[1] ? 0 : 0.55}
          color="#1a1a19"
        />
          ))}
        {/* B4: only the object itself and its base pick (never its shadows on the floor) */}
        <group ref={liftRef} userData={{ part: true, focusRoot: true }}>
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
