'use client';

import { perfOff } from '@/lib/perfFlags';

import { advance, Canvas, events as createPointerEvents, useFrame, useThree, type RootState } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { Suspense, useEffect, useRef, useState } from 'react';
import { loadLTC } from '@/lib/ltc';
import { markDirty } from '@/lib/dirty';
import { capturedEnvironment } from './environment';
import { isMobileTier } from '@/lib/perfTier';
import { revealed } from '@/lib/reveal';
import { Box3, Euler, Matrix4, Quaternion, Vector3, type Intersection, type Mesh, type Object3D } from 'three';
import { lineup } from '@/content/work';
import { attachRenderer, requestFrames, setContinuous } from '@/lib/clock';
import { lampById } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { frameRect, onViewsChanged, stageRect } from '@/lib/views';
import { BoothRoom } from './BoothRoom';
import { Certificate } from './Certificate';
import { CameraRig } from './CameraRig';
import { LampRig } from './LampRig';
import { HoverLight } from './HoverLight';
import { ObjectSlot } from './ObjectSlot';
import { PerfProbe } from './PerfProbe';
import { perfInfo } from '@/lib/perfTier';
import { modelsSettled } from './models';
import { contextLost, contextRestored } from '@/lib/resilience';
import { Post, postApi } from './Post';
import { ModelRef } from './ModelRef';
import { clearShotCaches, lineupShot, trayShot } from './shots';
import { registerLayoutGate } from './layoutSwitch';
import { useLayoutKey } from './useLayout';
import { aoReady } from './BoothRoom';
import { invalidateShadows } from './LampRig';
import { measureViewport, onBeforeShapeChange, useShape } from '@/lib/shape';
import { logEvent } from '@/lib/eventLog';
import { useReducedMotion } from '@/lib/useReducedMotion';
import type { BoothLightmap } from './BoothRoom';
import { BOOTH, CABINET_FACE, CERTIFICATE, FACE_Z, FOCAL_MM, FOV, PLINTH_CHAMFER, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY, lineupLayout, sizeFloor, activeLayout, layoutKeyFor, setActiveLayout, type LayoutKey } from './staging';

declare global {
  interface Window {
    __boothBench?: (n?: number, moving?: boolean) => { p50: number; p95: number };
  }
  interface Window {
    /** Projected width of every sample (object only, no plinth) as % of the viewport width, from the live camera. */
    __boothSizes?: () => Record<string, number>;
    __boothSizeFloors?: () => Record<string, number>;
    /** F1: every sample's projected box (viewport px) and the smallest 3D clearance between any two samples (m). */
    __boothBoxes?: () => { boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }>; minGap: { m: number; a: string; b: string } };
    __boothMounts?: number;
    /** Staging + camera data for tools/export-camera.mjs (Blender scene). */
    __boothExport?: (aspect: number) => unknown;
    __boothPickAt?: (x: number, y: number) => { pick: string | null; seen: string | null };
    __boothVisibility?: (slug: string) => { visible: number; total: number; fraction: number };
    /** Capture readiness, including models arriving after the safety reveal. */
    __boothSettled?: () => boolean;
    __boothProbePoints?: () => { wall: { x: number; y: number }; paper: { x: number; y: number } };
  }
}

const SLUGS = lineup.map((w) => w.slug);
/** ?modelref=<slug>: one GLB alone, like its Blender reference render (tools/model-ref.mjs). */
const MODEL_REF = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('modelref') : null;

/** Booth pointer events only inside the stage rect (the camera's projection spans the whole canvas). */
function stageEvents(store: Parameters<typeof createPointerEvents>[0]) {
  const base = createPointerEvents(store);
  return {
    ...base,
    compute(event: { clientX: number; clientY: number; target: EventTarget | null }, state: RootState) {
      const r = stageRect();
      const t = event.target as Element | null;
      // events bubble to <body>; ignore any that started on real page UI over the booth. The masthead's
      // empty space is not UI: on project pages the raised samples sit under it and must stay clickable
      // (its links and buttons are caught by "a, button").
      const onUi = !!t?.closest?.('a, button, input, .panel, .work__body, .footer, .houselights, .page');
      const inside =
        !onUi && r && event.clientX >= r.left && event.clientX <= r.left + r.width && event.clientY >= r.top && event.clientY <= r.top + r.height;
      if (!r || !inside) state.pointer.set(9, 9);
      else state.pointer.set((event.clientX / state.size.width) * 2 - 1, -(event.clientY / state.size.height) * 2 + 1);
      // world matrices as drawn: some GLB subtrees are only refreshed inside the render itself
      state.scene.updateMatrixWorld();
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
    /**
     * B4: only what is seen can be picked. A hit counts if the mesh and every parent are visible and
     * no slot on the way marks itself unpickable (less than 60% of it inside the view), and nothing
     * solid of the cabinet (frame, hood, housing, lip) is in front of it.
     */
    filter(items: Intersection[], state: RootState) {
      const seen = items.filter((i) => pickable(i.object) && isPart(i.object) && solid(i.object));
      if (!seen.length) return seen;
      // anything solid that is not a sample (walls, cabinet, tray, floor) nearer than the first
      // sample hides it; and only the nearest sample is hit (never one behind it)
      occluders ??= collectOccluders(state.scene);
      const first = seen[0];
      const wall = state.raycaster.intersectObjects(occluders, false).find((h) => pickable(h.object) && solid(h.object));
      if (wall && wall.distance < first.distance - 1e-4) return [];
      const slug = slugOf(first.object);
      return seen.filter((i) => slugOf(i.object) === slug);
    },
  };
}
let occluders: Object3D[] | null = null;
/** Every mesh of the booth that is not part of a sample (collected once: the booth shell and tray are static). */
function collectOccluders(scene: Object3D) {
  const out: Object3D[] = [];
  scene.traverse((o) => {
    if ((o as Mesh).isMesh && !slugOf(o)) out.push(o);
  });
  return out;
}
function slugOf(o: Object3D | null) {
  for (; o; o = o.parent) if (o.userData.slug) return o.userData.slug as string;
  return null;
}
function isPart(o: Object3D | null) {
  for (; o; o = o.parent) if (o.userData.part) return true;
  return false;
}
/** A surface the eye stops at: drawn opaque (not a shadow catcher or a sheet of glass). */
function solid(o: Object3D) {
  const m = (o as Mesh).material as { transparent?: boolean; depthWrite?: boolean; visible?: boolean; opacity?: number } | undefined;
  return !!m && !Array.isArray(m) ? m.visible !== false && !(m.transparent && (m.depthWrite === false || (m.opacity ?? 1) < 0.05)) : !!m;
}
function pickable(o: Object3D | null) {
  for (; o; o = o.parent) if (!o.visible || o.userData.pickable === false) return false;
  return true;
}

/**
 * B4 test hook (tools/check-picking.mjs): what a click at (clientX, clientY) would open, through
 * the real event filter, and what is actually seen there (the nearest visible mesh of any kind).
 */
function PickProbe() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    // Test-only CPU raycasts: compare the sample's projected silhouette with the opaque scene.
    // Unlike a bounding-box check this detects shelf boards hiding the actual model.
    window.__boothVisibility = (slug) => {
      const state = get();
      state.scene.updateMatrixWorld(true);
      const visible = (o: Object3D | null) => {
        for (; o; o = o.parent) if (!o.visible) return false;
        return true;
      };
      const scene: Object3D[] = [], sample: Object3D[] = [];
      const bounds = new Box3();
      state.scene.traverse((o) => {
        if (!(o as Mesh).isMesh || !visible(o) || !solid(o)) return;
        scene.push(o);
        if (slugOf(o) === slug && isPart(o)) {
          sample.push(o);
          bounds.expandByObject(o);
        }
      });
      if (!sample.length) return { visible: 0, total: 0, fraction: 0 };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const v = new Vector3(x, y, z).project(state.camera);
            x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
            y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
          }
      let total = 0, seen = 0;
      for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
        state.pointer.set(x0 + (i + 0.5) / 40 * (x1 - x0), y0 + (j + 0.5) / 40 * (y1 - y0));
        state.raycaster.setFromCamera(state.pointer, state.camera);
        if (!state.raycaster.intersectObjects(sample, false).length) continue;
        total++;
        if (Math.abs(state.pointer.x) > 1 || Math.abs(state.pointer.y) > 1) continue;
        const front = state.raycaster.intersectObjects(scene, false)[0];
        if (front && slugOf(front.object) === slug) seen++;
      }
      state.pointer.set(9, 9);
      return { visible: seen, total, fraction: total ? seen / total : 0 };
    };
    window.__boothPickAt = (cx: number, cy: number) => {
      const state = get();
      const r = stageRect();
      if (!r || cx < r.left || cx > r.left + r.width || cy < r.top || cy > r.top + r.height) return { pick: null, seen: null };
      state.pointer.set((cx / state.size.width) * 2 - 1, -(cy / state.size.height) * 2 + 1);
      state.scene.updateMatrixWorld();
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObjects(state.internal.interaction, true);
      const kept = state.events.filter ? state.events.filter(hits, state) : hits;
      const all = state.raycaster.intersectObjects(state.scene.children, true).filter((h) => (h.object as Mesh).isMesh && pickable(h.object) && solid(h.object));
      return { pick: slugOf(kept[0]?.object ?? null), seen: slugOf(all[0]?.object ?? null) };
    };
  }, [get]);
  return null;
}

/** Exposes window.__boothSizes for tools/check-sizes.mjs (projects through the live camera, lens shift included). */
function SizeProbe() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    window.__boothSizes = () => {
      // E (08): the long side (width, or height for a portrait piece) as % of the cabinet's projected
      // width (the cabinet face, at the opening); NDC x and y scale by W/2 and H/2
      const ar = window.innerHeight / window.innerWidth;
      const fz = FACE_Z;
      const ca = new Vector3(-CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cb = new Vector3(CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      // G (08), L3 (09B): the square cabinet and the shelf measure against the frame's width (the box
      // the arrangement is composed for) instead of the cabinet's
      const f = activeLayout().key !== 'wide' ? frameRect() : null;
      const cab = f ? (2 * f.width) / window.innerWidth : cb.x - ca.x;
      const out: Record<string, number> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const fy = st.y ?? 0;
        const y = fy + st.base.h + st.object.h / 2;
        const z = st.z + st.object.d / 2;
        const a = new Vector3(st.x - st.object.w / 2, y, z).project(camera);
        const b = new Vector3(st.x + st.object.w / 2, y, z).project(camera);
        const lo = new Vector3(st.x, fy + st.base.h, z).project(camera);
        const hi = new Vector3(st.x, fy + st.base.h + st.object.h, z).project(camera);
        out[w.slug] = +((Math.max(b.x - a.x, (hi.y - lo.y) * ar) / cab) * 100).toFixed(1);
      }
      return out;
    };
    // L3 (09B): the tall shelf 14%, the square shelf and the square cabinet 12% (of the frame); the wide cabinet its own floors
    window.__boothSizeFloors = () => {
      const k = activeLayout().key;
      return Object.fromEntries(lineup.map((w) => [w.slug, k === 'wide' ? sizeFloor(w.slug) : k === 'square' || k === 'shelf4' ? 12 : 14]));
    };
    window.__boothBoxes = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
      const aabb: Record<string, [number, number, number, number, number, number]> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const { w: ow, h: oh, d: od } = st.object;
        const y0 = (st.y ?? 0) + st.base.h;
        aabb[w.slug] = [st.x - ow / 2, y0, st.z - od / 2, st.x + ow / 2, y0 + oh, st.z + od / 2];
        let x0 = Infinity, yy0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const cx of [st.x - ow / 2, st.x + ow / 2])
          for (const cy of [y0, y0 + oh])
            for (const cz of [st.z - od / 2, st.z + od / 2]) {
              const v = new Vector3(cx, cy, cz).project(camera);
              const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
              x0 = Math.min(x0, px); x1 = Math.max(x1, px); yy0 = Math.min(yy0, py); y1 = Math.max(y1, py);
            }
        boxes[w.slug] = { x0, y0: yy0, x1, y1 };
      }
      {
        // the About certificate on the shelf (B2): part of the no-overlap rule, not of the 11% rule
        const c = CERTIFICATE, y0 = PROPS.ledge.y + PROPS.ledge.h, zc = c.z;
        aabb.about = [c.x - c.w / 2 - 0.012, y0, zc - 0.03, c.x + c.w / 2 + 0.012, y0 + c.h + 0.024, zc + 0.01];
        let x0 = Infinity, yy0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const cx of [aabb.about[0], aabb.about[3]])
          for (const cy of [aabb.about[1], aabb.about[4]])
            for (const cz of [aabb.about[2], aabb.about[5]]) {
              const v = new Vector3(cx, cy, cz).project(camera);
              const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
              x0 = Math.min(x0, px); x1 = Math.max(x1, px); yy0 = Math.min(yy0, py); y1 = Math.max(y1, py);
            }
        boxes.about = { x0, y0: yy0, x1, y1 };
      }
      let minGap = { m: Infinity, a: '', b: '' };
      const slugs = Object.keys(aabb);
      for (let i = 0; i < slugs.length; i++)
        for (let j = i + 1; j < slugs.length; j++) {
          const A = aabb[slugs[i]], B = aabb[slugs[j]];
          const dx = Math.max(0, A[0] - B[3], B[0] - A[3]);
          const dy = Math.max(0, A[1] - B[4], B[1] - A[4]);
          const dz = Math.max(0, A[2] - B[5], B[2] - A[5]);
          const d = Math.hypot(dx, dy, dz);
          if (d < minGap.m) minGap = { m: +d.toFixed(3), a: slugs[i], b: slugs[j] };
        }
      return { boxes, minGap };
    };
    // B5 calibration points in viewport CSS px: a bare patch of the back wall (top left, clear of
    // every object) and the certificate's white paper (its lower right, away from the type)
    window.__boothProbePoints = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const at = (v: Vector3) => {
        const p = v.project(camera);
        return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H };
      };
      const top = PROPS.ledge.y + PROPS.ledge.h + CERTIFICATE.h * 0.18;
      return {
        wall: at(new Vector3(-0.2, 0.68, BOOTH.backZ + 0.002)),
        paper: at(new Vector3(CERTIFICATE.x + CERTIFICATE.w * 0.3, top, CERTIFICATE.z + CERTIFICATE.d / 2 + 0.002)),
      };
    };
  }, [camera]);
  return null;
}


/**
 * L2 (09B): a change of arrangement (a shape crossed by a resize or a rotation, or a tall screen
 * moving between the shelf and a project's tray) never shows a half-built frame. The frame on screen
 * is kept (copied once, on the GPU, into a 2D canvas over the WebGL one, the moment before the page
 * changes), the new arrangement is applied (shared models and textures, only transforms, bases, the
 * camera and the AO map change), its shaders are compiled and its AO map is in, one full frame is
 * drawn under the cover, then the cover crossfades to the live canvas over 250ms (no fade under
 * reduced motion). No pass is added or removed; nothing is read back to the CPU.
 */
function LayoutGate() {
  const get = useThree((s) => s.get);
  const key = useLayoutKey();
  const keyNow = useRef(key);
  keyNow.current = key;
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const cover = useRef<HTMLCanvasElement | null>(null);
  const covered = useRef(false);
  const pending = useRef<{ key: LayoutKey; compiled: boolean; frames: number; t0: number } | null>(null);
  useEffect(() => {
    const canvas = () => get().gl.domElement;
    const host = () => canvas().closest('.booth-canvas') as HTMLElement | null;
    const snapshot = () => {
      if (!revealed.value || covered.current) return;
      const src = canvas();
      // Reproduce the prior rendered framing, before resize updates can move its camera or masks.
      if (!postApi.snapshot()) advance(performance.now() / 1000, true, get());
      let c = cover.current;
      if (!c) {
        c = document.createElement('canvas');
        c.className = 'booth-cover';
        c.setAttribute('aria-hidden', 'true');
        host()?.appendChild(c);
        cover.current = c;
      }
      c.width = src.width;
      c.height = src.height;
      c.getContext('2d')?.drawImage(src, 0, 0);
      c.style.transition = 'none';
      c.style.opacity = '1';
      c.hidden = false;
      src.style.transition = 'none';
      src.style.opacity = '0';
      covered.current = true;
    };
    const apply = (k: LayoutKey) => {
      setActiveLayout(k);
      clearShotCaches();
      occluders = null;
      invalidateShadows();
      markDirty('layout', undefined, 3);
      pending.current = { key: k, compiled: false, frames: 0, t0: performance.now() };
      logEvent(`layout → ${k}`);
      requestFrames(2);
    };
    const offBefore = onBeforeShapeChange((next) => {
      const mode = (document.querySelector('.booth-stage') as HTMLElement | null)?.dataset.mode as 'full' | 'header' | undefined;
      if (layoutKeyFor(next.shape, next.columns, mode ?? 'off') !== activeLayout().key) snapshot();
    });
    const resize = () => {
      if (useBooth.getState().houseLights) return;
      if ((document.querySelector('.booth-stage') as HTMLElement | null)?.dataset.mode !== 'full') return;
      snapshot();
      if (!covered.current) return;
      // A second resize during the fade keeps the original cover until the latest view is ready.
      const c = cover.current!;
      c.style.transition = 'none'; c.style.opacity = '1'; c.hidden = false;
      canvas().style.transition = 'none'; canvas().style.opacity = '0';
      pending.current = { key: activeLayout().key, compiled: false, frames: 0, t0: performance.now() };
      requestFrames(2);
    };
    window.addEventListener('resize', resize);
    const offGate = registerLayoutGate((k, why) => {
      if (!revealed.value) {
        setActiveLayout(k);
        clearShotCaches();
        occluders = null;
        return;
      }
      if (why === 'shape') snapshot();
      else {
        // a route change: the page under it has changed already, so there is no old frame to keep;
        // the canvas waits, hidden, and fades in on its first full frame
        canvas().style.transition = 'none';
        canvas().style.opacity = '0';
        if (cover.current) cover.current.hidden = true;
        covered.current = false;
      }
      apply(k);
    });
    return () => {
      offBefore();
      offGate();
      window.removeEventListener('resize', resize);
      cover.current?.remove();
      cover.current = null;
    };
  }, [get]);
  useFrame(() => {
    const p = pending.current;
    if (!p) return;
    const { gl, scene, camera } = get();
    const viewport = measureViewport(), shape = useShape.getState();
    if (Math.abs(shape.w - viewport.w) / shape.w > 0.02 || Math.abs(shape.h - viewport.h) / shape.h > 0.02) {
      requestFrames(1);
      return;
    }
    // the new tree has committed (this component re-rendered with the key), the AO map is in
    if (keyNow.current !== p.key || !aoReady(p.key)) {
      if (performance.now() - p.t0 < 4000) {
        requestFrames(1);
        return;
      }
    }
    if (!p.compiled) {
      p.compiled = true;
      gl.compile(scene, camera);
      requestFrames(2);
      return;
    }
    if (++p.frames < 2) {
      requestFrames(1);
      return;
    }
    pending.current = null;
    const src = gl.domElement;
    const ms = reducedRef.current ? 0 : 250;
    src.style.transition = ms ? `opacity ${ms}ms linear` : 'none';
    src.style.opacity = '1';
    const c = cover.current;
    if (c && covered.current) {
      c.style.transition = ms ? `opacity ${ms}ms linear` : 'none';
      c.style.opacity = '0';
      const finish = () => {
        if (pending.current) return;
        // A blocked main thread can run this timer before CSS presents the completed fade.
        // Keep the old frame until the live canvas is actually opaque.
        if (Number(getComputedStyle(src).opacity) < 0.999) {
          window.requestAnimationFrame(finish);
          return;
        }
        c.hidden = true;
        covered.current = false;
      };
      window.setTimeout(finish, ms + 50);
    }
    logEvent(`layout ${p.key} drawn (${Math.round(performance.now() - p.t0)}ms)`);
  }, 1);
  return null;
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
    // ?perf: render N frames synchronously, each closed with a 1px readback, and time them. A
    // like-for-like cost per lamp / per tier, independent of the display's refresh cadence.
    if (window.location.search.includes('perf')) {
      window.__boothBench = (n = 30, moving = false) => {
        const ctx = get().gl.getContext();
        const px = new Uint8Array(4);
        const frame = () => {
          // B5 (08): `moving` forces every side render (reflector, shadow, normals) on every frame, as
          // while the camera drifts; otherwise frames where nothing changed reuse them
          if (moving) markDirty('bench (moving)', undefined, 1);
          advance(performance.now() / 1000, true, get());
          ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); // a real sync point (finish() may not block)
        };
        for (let i = 0; i < 4; i++) frame(); // warm-up: shader compiles, texture uploads
        const ms: number[] = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          frame();
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return { p50: +ms[Math.floor(n * 0.5)].toFixed(1), p95: +ms[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(1) };
      };
    }
    return () => {
      attachRenderer(null);
      off();
    };
  }, [get, set]);
  const lamp = useBooth((s) => s.lamp);
  useEffect(() => setContinuous(lampById(lamp).continuous), [lamp]);
  // C2 (08): ready (the poster crossfades to the live booth, 300ms) only once the visible lineup's
  // models are in, the active lamp's interior environment has been captured, every shader program
  // is compiled, and one full frame has been drawn after that. Models never pop into a visible
  // booth. A safety reveal after 15s if a model fails to load.
  const t0 = useRef(performance.now());
  const done = useRef(false);
  const compiled = useRef(false);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    window.__boothSettled = () => modelsSettled() && (isMobileTier() || perfOff('envcapture') || activeLayout().kind === 'shelf' || !!capturedEnvironment(useBooth.getState().lamp));
    return () => { delete window.__boothSettled; };
  }, []);
  useFrame(() => {
    frames.current++;
    if (done.current || frames.current < 3) return;
    const timedOut = performance.now() - t0.current > 15000;
    const envReady = isMobileTier() || perfOff('envcapture') || activeLayout().kind === 'shelf' || !!capturedEnvironment(useBooth.getState().lamp);
    if (!timedOut && !(modelsSettled() && envReady)) {
      requestFrames(1);
      return;
    }
    if (!compiled.current) {
      // A3: every program the scene can need (hidden pieces included: the haze cone, the tray-shot
      // neighbours, the screen light), compiled before the reveal so nothing compiles mid-view
      compiled.current = true;
      const hidden: { visible: boolean }[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      gl.compile(scene, camera);
      hidden.forEach((o) => (o.visible = false));
      requestFrames(1); // one full frame with everything in place, then reveal
      return;
    }
    done.current = true;
    revealed.value = true;
    onReady();
  }, 2);
  return null;
}

/**
 * The one and only canvas: fixed, full-screen, transparent, behind the page,
 * never remounted. It draws the booth into the stage rect and the proof-strip
 * planes into their image rects, on demand, from the page's single clock.
 */
export default function BoothCanvas({ onReady, lightmap = null }: { onReady: () => void; lightmap?: BoothLightmap | null }) {
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
      bases: lineup.map((w) => {
        const L = lineupLayout(SLUGS);
        return {
          slug: w.slug,
          position: [L.x[w.slug], STAGING[w.slug].base.h / 2, L.z[w.slug]],
          size: STAGING[w.slug].base,
          objectBase: [L.x[w.slug], STAGING[w.slug].base.h, L.z[w.slug]],
          objectSize: STAGING[w.slug].object,
        };
      }),
      props: PROPS,
    });
  }, []);

  // the area lights' lookup tables arrive as a texture before anything renders
  const [ltc, setLtc] = useState(false);
  useEffect(() => {
    void loadLTC().then(() => setLtc(true));
  }, []);

  const perf = perfInfo();
  const mobile = perf.tier === 'mobile';

  return (
    <Canvas
      frameloop="never"
      // B2 (08): variance shadow maps: the softness is a blur baked into the map when it re-renders (only
      // on a change, lib/dirty.ts), so receiving a soft shadow costs one lookup per pixel. `?perf&no=vsm`
      // restores the 07 path (PCF + per-pixel PCSS) for an A/B on the GPU.
      shadows={perfOff('vsm') ? 'percentage' : 'variance'}
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, perf.dprCap) : 1}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: FOV, position: [0, 0.4, 5] }}
      events={stageEvents}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      onPointerMissed={() => (document.body.style.cursor = '')}
      onCreated={({ gl }) => {
        // I4: a lost context drops to house lights at once; a restored one brings the booth back
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          contextLost();
        });
        gl.domElement.addEventListener('webglcontextrestored', () => contextRestored());
      }}
    >
      {ltc && <ClockBridge onReady={onReady} />}
      {ltc && <LayoutGate />}
      {!ltc ? null : MODEL_REF ? (
        <ModelRef slug={MODEL_REF} />
      ) : (
        <>
          <SizeProbe />
          <PickProbe />
          <CameraRig />
          <LampRig />
          <HoverLight />
          {perfOff('vsm') && !perfOff('pcss') && <SoftShadows size={mobile ? 18 : 26} samples={mobile ? 8 : 14} focus={0.2} />}
          <BoothRoom lineup={SLUGS} lightmap={lightmap} />
          {lineup.map((w) => (
            <ObjectSlot key={w.slug} work={w} lineup={SLUGS} />
          ))}
          <Certificate />
        </>
      )}
      <Post />
      <PerfProbe readout={typeof window !== 'undefined' && window.location.search.includes('perf')} />
    </Canvas>
  );
}
