'use client';

import { perfOff } from '@/lib/perfFlags';

import { advance, Canvas, events as createPointerEvents, useFrame, useThree, type RootState } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { Suspense, useEffect, useRef, useState } from 'react';
import { loadLTC } from '@/lib/ltc';
import { Euler, Matrix4, Quaternion, Vector3, type Intersection, type Mesh, type Object3D } from 'three';
import { lineup } from '@/content/work';
import { attachRenderer, requestFrames, setContinuous } from '@/lib/clock';
import { lampById } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { onViewsChanged, stageRect } from '@/lib/views';
import { BoothRoom } from './BoothRoom';
import { Certificate } from './Certificate';
import { CameraRig } from './CameraRig';
import { LampRig } from './LampRig';
import { ObjectSlot } from './ObjectSlot';
import { PerfProbe } from './PerfProbe';
import { perfInfo } from '@/lib/perfTier';
import { modelsSettled } from './models';
import { contextLost, contextRestored } from '@/lib/resilience';
import { Post } from './Post';
import { ModelRef } from './ModelRef';
import { lineupShot, trayShot } from './shots';
import { BOOTH, CABINET_FACE, CERTIFICATE, FACE_Z, FOCAL_MM, FOV, PLINTH_CHAMFER, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY, lineupLayout } from './staging';

declare global {
  interface Window {
    __boothBench?: (n?: number) => { p50: number; p95: number };
  }
  interface Window {
    /** Projected width of every sample (object only, no plinth) as % of the viewport width, from the live camera. */
    __boothSizes?: () => Record<string, number>;
    /** F1: every sample's projected box (viewport px) and the smallest 3D clearance between any two samples (m). */
    __boothBoxes?: () => { boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }>; minGap: { m: number; a: string; b: string } };
    __boothMounts?: number;
    /** Staging + camera data for tools/export-camera.mjs (Blender scene). */
    __boothExport?: (aspect: number) => unknown;
    __boothPickAt?: (x: number, y: number) => { pick: string | null; seen: string | null };
    __boothProbePoints?: () => { wall: { x: number; y: number }; paper: { x: number; y: number } };
  }
}

const SLUGS = lineup.map((w) => w.slug);
/** ?modelref=<slug>: one GLB alone, like its Blender reference render (tools/model-ref.mjs). */
const MODEL_REF = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('modelref') : null;
const LAYOUT = lineupLayout(SLUGS);

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
      // % of the cabinet's projected width (the cabinet face, at the opening)
      const fz = FACE_Z;
      const ca = new Vector3(-CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cb = new Vector3(CABINET_FACE.w / 2, BOOTH.height / 2, fz).project(camera);
      const cab = cb.x - ca.x;
      const out: Record<string, number> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const y = st.base.h + st.object.h / 2;
        const z = st.z + st.object.d / 2;
        const a = new Vector3(st.x - st.object.w / 2, y, z).project(camera);
        const b = new Vector3(st.x + st.object.w / 2, y, z).project(camera);
        out[w.slug] = +(((b.x - a.x) / cab) * 100).toFixed(1);
      }
      return out;
    };
    window.__boothBoxes = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
      const aabb: Record<string, [number, number, number, number, number, number]> = {};
      for (const w of lineup) {
        const st = STAGING[w.slug];
        const { w: ow, h: oh, d: od } = st.object;
        const y0 = st.base.h;
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
        const c = CERTIFICATE, y0 = PROPS.ledge.y + PROPS.ledge.h, zc = BOOTH.backZ + 0.035;
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
        paper: at(new Vector3(CERTIFICATE.x + CERTIFICATE.w * 0.3, top, BOOTH.backZ + 0.035 + CERTIFICATE.d / 2 + 0.002)),
      };
    };
  }, [camera]);
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
      window.__boothBench = (n = 30) => {
        const ctx = get().gl.getContext();
        const px = new Uint8Array(4);
        const frame = () => {
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
  // Ready (the poster crossfades to the live booth) once three lit frames are drawn and every GLB
  // is in, so the booth never appears half-lit or half-built; at most 8s after mount regardless.
  const t0 = useRef(performance.now());
  const done = useRef(false);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    frames.current++;
    if (done.current || frames.current < 3) return;
    if (modelsSettled() || performance.now() - t0.current > 8000) {
      done.current = true;
      onReady();
      // A3: compile every program the scene can need (hidden pieces included: the haze cone, the
      // tray-shot neighbours) once, while idle, so no lamp or route change ever compiles a shader
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle(() => {
        const hidden: { visible: boolean }[] = [];
        scene.traverse((o) => {
          if (!o.visible) {
            hidden.push(o);
            o.visible = true;
          }
        });
        // synchronous, so no frame can ever be drawn while the hidden pieces are switched on
        gl.compile(scene, camera);
        hidden.forEach((o) => (o.visible = false));
      });
    } else requestFrames(1);
  }, 2);
  return null;
}

/**
 * The one and only canvas: fixed, full-screen, transparent, behind the page,
 * never remounted. It draws the booth into the stage rect and the proof-strip
 * planes into their image rects, on demand, from the page's single clock.
 */
export default function BoothCanvas({ onReady, lightmap = null }: { onReady: () => void; lightmap?: string | null }) {
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
      bases: lineup.map((w) => ({
        slug: w.slug,
        position: [LAYOUT.x[w.slug], STAGING[w.slug].base.h / 2, LAYOUT.z[w.slug]],
        size: STAGING[w.slug].base,
        objectBase: [LAYOUT.x[w.slug], STAGING[w.slug].base.h, LAYOUT.z[w.slug]],
        objectSize: STAGING[w.slug].object,
      })),
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
      shadows="percentage"
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
      {!ltc ? null : MODEL_REF ? (
        <ModelRef slug={MODEL_REF} />
      ) : (
        <>
          <SizeProbe />
      <PickProbe />
          <CameraRig />
          <LampRig />
          {!perfOff('pcss') && <SoftShadows size={mobile ? 18 : 26} samples={mobile ? 8 : 14} focus={0.2} />}
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
