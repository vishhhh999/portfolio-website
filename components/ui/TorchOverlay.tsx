'use client';

import { useEffect, useRef } from 'react';
import { useBooth } from '@/lib/store';
import { torch } from '@/lib/torch';

const STOPS = 24;

/**
 * AFTER DARK over the case-study images (C2). The images themselves are never redrawn: the page's
 * own <img>/<video> stays exactly the file, and this overlay, above the page content, darkens
 * everything outside the torch. The darkening is a soft circle (smootherstep from a flat core to
 * the edge, 24 gradient stops, dithered by the browser), fully transparent in the core: there the
 * visitor sees the file's own pixels, multiplier exactly 1. No tone mapping, bloom, matrix or
 * tint can reach an image. Exists only while AFTER DARK is on.
 */
export function TorchOverlay() {
  const on = useBooth((s) => s.lamp === 'AFTERDARK' && !s.houseLights);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!on || !c) return;
    const ctx = c.getContext('2d')!;
    // without the booth (house lights off but no canvas yet), follow the pointer directly
    const onMove = (e: PointerEvent) => {
      if (torch.fromRig) return;
      torch.x = e.clientX;
      torch.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    let last = '';
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = window.innerWidth, H = window.innerHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        last = '';
      }
      const frames = [...document.querySelectorAll<HTMLElement>('.proof__image img, .proof__image video')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.bottom > 0 && r.top < H && r.width > 0);
      const key = `${torch.x.toFixed(1)},${torch.y.toFixed(1)},${torch.r},${torch.level.toFixed(3)},${frames.map((r) => `${r.left},${r.top},${r.width},${r.height}`).join(';')}`;
      if (key === last) return;
      last = key;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!frames.length) return;
      const inner = torch.r * (1 - torch.soft);
      const g = ctx.createRadialGradient(torch.x, torch.y, Math.max(0, inner), torch.x, torch.y, torch.r);
      for (let i = 0; i <= STOPS; i++) {
        const t = i / STOPS;
        const m = 1 - t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: no visible knee
        const k = Math.min(1, (torch.outside + (1 - torch.outside) * m) * torch.level);
        g.addColorStop(t, `rgba(0,0,0,${(1 - k).toFixed(4)})`);
      }
      ctx.fillStyle = g;
      for (const r of frames) ctx.fillRect(r.left, r.top, r.width, r.height);
    };
    // its own small loop (not the shared clock's tickers, which would keep the booth drawing every
    // frame); it repaints only when the torch or a frame actually moved
    let id = 0;
    const loop = () => {
      draw();
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('pointermove', onMove);
      ctx.clearRect(0, 0, c.width, c.height);
    };
  }, [on]);

  if (!on) return null;
  return <canvas ref={ref} className="torch" aria-hidden="true" />;
}
