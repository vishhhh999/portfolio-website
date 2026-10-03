'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    __boothPerf?: () => { frames: number; avgMs: number; p95Ms: number; worstMs: number; fps: number };
  }
}

/**
 * Frame-time probe, enabled with ?perf in the URL. Shows a readout (top-left)
 * and exposes window.__boothPerf(). Flip lamps with keys 1–7 and read p95:
 * under 16.7ms holds 60fps.
 */
export function PerfProbe() {
  const samples = useRef<number[]>([]);
  const el = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:99;font:11px/1.3 ui-monospace,monospace;background:#000c;color:#9f9;padding:6px 8px;border-radius:3px;pointer-events:none;white-space:pre';
    document.body.appendChild(div);
    el.current = div;
    window.__boothPerf = () => {
      const s = [...samples.current].sort((a, b) => a - b);
      const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
      return { frames: s.length, avgMs: +avg.toFixed(2), p95Ms: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2), worstMs: +(s[s.length - 1] ?? 0).toFixed(2), fps: +(1000 / avg).toFixed(1) };
    };
    return () => div.remove();
  }, []);

  useFrame((_, dt) => {
    const ms = dt * 1000;
    if (ms > 250) return; // ignore resumes from idle (demand frameloop)
    samples.current.push(ms);
    if (samples.current.length > 600) samples.current.shift();
    if (el.current && samples.current.length % 15 === 0) {
      const r = window.__boothPerf!();
      el.current.textContent = `frame avg ${r.avgMs}ms  p95 ${r.p95Ms}ms  worst ${r.worstMs}ms\n${r.fps} fps over ${r.frames} frames`;
    }
  });
  return null;
}
