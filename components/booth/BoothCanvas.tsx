'use client';

import { advance, Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MathUtils, NeutralToneMapping, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three';
import { lineup } from '@/content/work';
import { useBooth } from '@/lib/store';
import { perfInfo } from '@/lib/perfTier';
import { contextLost, contextRestored } from '@/lib/resilience';
import { bindInvalidate, kick, visibility, wantsNextFrame } from './activity';
import { applyPose, ease, faceBox, fitPose, lerpPose, openingBox, trayBox, type Pose } from './camera';
import { layoutFor, type Layout } from './composition';
import { mainFrame, onFrames, thumbFrames, type FrameRect } from './frames';
import { modelsSettled, onSettled } from './loader';
import { objects, worldBox } from './registry';
import { Rig } from './Rig';
import { Room } from './Room';
import { Specimen } from './Specimen';
import { publishBoxes } from './overlay';

const MOVE_MS = 720;

declare global {
  interface Window {
    __boothBench?: (n?: number, moving?: boolean) => { p50: number; p95: number; dpr: number };
  }
}
const lerpRect = (a: FrameRect, b: FrameRect, t: number): FrameRect => ({ x: MathUtils.lerp(a.x, b.x, t), y: MathUtils.lerp(a.y, b.y, t), w: MathUtils.lerp(a.w, b.w, t), h: MathUtils.lerp(a.h, b.h, t) });

/** Keeps frames coming while something moves; measures frame time and moves the DPR with it. */
function Activity() {
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    bindInvalidate(() => invalidate());
    const el = gl.domElement.parentElement!;
    const io = new IntersectionObserver(([e]) => {
      visibility.onScreen = e.isIntersecting;
      if (e.isIntersecting) kick(100);
    });
    io.observe(el);
    const vis = () => {
      visibility.tabVisible = document.visibilityState === 'visible';
      if (visibility.tabVisible) kick(100);
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      bindInvalidate(null);
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  }, [invalidate, gl]);
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!window.location.search.includes('perf')) return;
    // ?perf: render n frames back to back, each closed with a 1px read (a real sync point), and time them.
    // `moving` turns the camera a little every frame (parallax), so nothing is reused between frames.
    window.__boothBench = (n = 60, moving = false) => {
      const ctx = get().gl.getContext();
      const px = new Uint8Array(4);
      const frame = (i: number) => {
        if (moving) window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth * (0.3 + 0.4 * ((i % 20) / 20)), clientY: innerHeight * 0.4 }));
        advance(performance.now() / 1000 + i * 0.016, true, get());
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      };
      for (let i = 0; i < 5; i++) frame(i);
      const ms: number[] = [];
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        frame(i);
        ms.push(performance.now() - t0);
      }
      ms.sort((a, b) => a - b);
      return { p50: +ms[Math.floor(n * 0.5)].toFixed(2), p95: +ms[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(2), dpr: get().viewport.dpr };
    };
  }, [get]);
  const perf = useMemo(() => perfInfo(), []);
  const dpr = useRef(perf.dprStart);
  const last = useRef(0);
  const deltas = useRef<number[]>([]);
  const good = useRef(0);
  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    // only consecutive frames say anything about speed
    if (dt < 100) {
      const d = deltas.current;
      d.push(dt);
      if (d.length > 30) d.shift();
      if (d.length === 30) {
        const med = [...d].sort((a, b) => a - b)[15];
        if (med > 24 && dpr.current > perf.dprMin) {
          dpr.current = Math.max(perf.dprMin, dpr.current * 0.85);
          setDpr(dpr.current);
          d.length = 0;
          good.current = 0;
        } else if (med < 17.5 && dpr.current < perf.dprMax && ++good.current > 90) {
          dpr.current = Math.min(perf.dprMax, dpr.current * 1.1);
          setDpr(dpr.current);
          d.length = 0;
          good.current = 0;
        }
      }
    }
    if (wantsNextFrame(now)) invalidate();
  }, -1);
  return null;
}

/** The current layout, from the viewport's shape (wide booth or tall booth). */
function useLayout(): Layout {
  const pick = () => (typeof window === 'undefined' ? layoutFor(1.6) : layoutFor(window.innerWidth / window.innerHeight));
  const [layout, setLayout] = useState(pick);
  useEffect(() => {
    let t = 0;
    const on = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setLayout((l) => (pick().key === l.key ? l : pick())), 150);
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return layout;
}

/**
 * Draws the booth into the page's frames. The main view (home frame or project header) with the
 * full camera, scissored to its rect; then, on tall screens' project pages, one small view per
 * thumbnail in the strip, each with only the room and its own object.
 */
function Renderer({ layout, onReady }: { layout: Layout; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const activeSlug = useBooth((s) => s.activeSlug);
  const thumbCam = useMemo(() => new PerspectiveCamera(26, 1, 0.05, 20), []);
  const anim = useRef<{ from: Pose; fromRect: FrameRect; t0: number } | null>(null);
  const shown = useRef<{ pose: Pose; rect: FrameRect; key: string } | null>(null);
  const parallax = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const ready = useRef<'wait' | 'compiling' | 'drawn' | 'done'>('wait');

  useEffect(() => onFrames(() => kick(50)), []);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    const onMove = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      parallax.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      parallax.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick(400);
    };
    if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl]);
  useEffect(() => {
    kick(MOVE_MS + 100);
  }, [activeSlug]);
  useEffect(() => onSettled(() => kick(200)), []);

  const box = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const cw = size.width, ch = size.height;
    gl.setScissorTest(false);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    const main = mainFrame();
    gl.shadowMap.needsUpdate = true;
    if (main) {
      // where the camera should be for this view
      const active = useBooth.getState().activeSlug;
      const tall = layout.key === 'grid';
      let target: Pose;
      if (main.kind === 'home') target = fitPose(layout, faceBox(layout), main.rect, cw, ch);
      else if (!tall) target = fitPose(layout, openingBox(layout), main.rect, cw, ch, { fill: 1, pitch: 0.08 });
      else {
        const h = active ? objects.get(active)?.size.y ?? 0.25 : 0.25;
        target = fitPose(layout, trayBox(layout, h), main.rect, cw, ch, { fov: 30 });
      }
      const key = `${main.kind}:${layout.key}:${main.kind === 'header' && tall ? active : ''}`;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (shown.current && shown.current.key !== key && !reduced && ready.current === 'done') {
        anim.current = { from: shown.current.pose, fromRect: shown.current.rect, t0: performance.now() };
      }
      let pose = target, rect = main.rect;
      if (anim.current) {
        const t = Math.min(1, (performance.now() - anim.current.t0) / MOVE_MS);
        const k = ease(t);
        pose = lerpPose(anim.current.from, target, k);
        rect = lerpRect(anim.current.fromRect, main.rect, k);
        if (t >= 1) anim.current = null;
        else kick(32);
      }
      shown.current = { pose, rect, key };
      // a little parallax under a fine pointer (at most a degree), never on the phone strip
      const p = parallax.current;
      p.x = MathUtils.damp(p.x, p.tx, 4, dt);
      p.y = MathUtils.damp(p.y, p.ty, 4, dt);
      if (Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) > 0.002) kick(32);
      applyPose(camera, pose, cw / ch, p.x * 0.012, -p.y * 0.006);
      camera.layers.enableAll();
      gl.setViewport(0, 0, cw, ch);
      gl.setScissor(rect.x, ch - rect.y - rect.h, rect.w, rect.h);
      gl.setScissorTest(true);
      gl.render(scene, camera);
      publishBoxes(camera, cw, ch, rect);
    } else publishBoxes(null, cw, ch, null);

    // the phone strip: each other object in its own small view
    for (const t of thumbFrames()) {
      const e = objects.get(t.slug);
      if (!e) continue;
      let r = t.rect;
      if (t.clip) {
        const x0 = Math.max(r.x, t.clip.x), x1 = Math.min(r.x + r.w, t.clip.x + t.clip.w);
        if (x1 - x0 < 1) continue;
        gl.setScissor(x0, ch - r.y - r.h, x1 - x0, r.h);
      } else gl.setScissor(r.x, ch - r.y - r.h, r.w, r.h);
      const wb = worldBox(t.slug);
      if (!wb) continue;
      const c = wb.getCenter(box);
      const s = e.size;
      const radius = Math.max(s.x, s.y * 1.1, 0.12) * 0.62;
      thumbCam.fov = 26;
      thumbCam.aspect = r.w / r.h;
      const dist = radius / Math.tan(MathUtils.degToRad(thumbCam.fov / 2)) / Math.min(1, thumbCam.aspect);
      thumbCam.position.set(c.x, c.y + dist * 0.2, c.z + dist);
      thumbCam.lookAt(c);
      thumbCam.updateProjectionMatrix();
      thumbCam.layers.set(0);
      thumbCam.layers.enable(e.layer);
      gl.setViewport(r.x, ch - r.y - r.h, r.w, r.h);
      gl.setScissorTest(true);
      gl.render(scene, thumbCam);
      r = t.rect;
    }
    gl.setScissorTest(false);

    // reveal once every model the view needs is in, its shaders compiled, and one frame drawn
    if (ready.current === 'wait' && modelsSettled() && objects.size >= lineup.length) {
      ready.current = 'compiling';
      void gl.compileAsync(scene, camera).then(() => {
        ready.current = 'drawn';
        kick(100);
      });
    } else if (ready.current === 'drawn') {
      ready.current = 'done';
      requestAnimationFrame(() => onReady());
    }
    if (ready.current !== 'done') kick(100);
  }, 1);
  return null;
}

/**
 * The one canvas: it sits in the booth layer (which scrolls with the page), never remounts across
 * routes, and draws only when something changes.
 */
export default function BoothCanvas({ onReady }: { onReady: () => void }) {
  const layout = useLayout();
  const perf = perfInfo();
  return (
    <Canvas
      frameloop="demand"
      shadows={{ type: PCFShadowMap }}
      dpr={perf.dprStart}
      flat={false}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false, premultipliedAlpha: true }}
      camera={{ fov: 26, near: 0.05, far: 30, position: [0, 0.5, 3] }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.autoClear = false;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          contextLost();
        });
        gl.domElement.addEventListener('webglcontextrestored', () => contextRestored());
      }}
      style={{ pointerEvents: 'none' }}
    >
      <Activity />
      <Renderer layout={layout} onReady={onReady} />
      <Rig layout={layout} />
      <Room layout={layout} />
      {lineup.map((w, i) => (
        <Specimen key={w.slug} work={w} layout={layout} index={i} />
      ))}
    </Canvas>
  );
}
