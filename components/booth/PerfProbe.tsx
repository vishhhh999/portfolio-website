'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useBooth } from '@/lib/store';
import { perfInfo, perfState } from '@/lib/perfTier';

declare global {
  interface Window {
    __boothPerf?: () => {
      frames: number;
      fps: number;
      p50Ms: number;
      p95Ms: number;
      worstMs: number;
      dpr: number;
      tier: string;
      lamp: string;
      lowPower: boolean;
      cores: number;
      renderer: string;
    };
  }
}

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

/**
 * Frame monitor, always on. Records frame deltas while frames are consecutive (on-demand
 * rendering leaves gaps, which are not frame time).
 *
 * Mobile tier: adaptive DPR. If p95 frame time stays over 20ms for 2s, DPR steps down 0.25,
 * to a floor of 1.0, and never goes back up this session. Frames pinned near 33ms with no heavy
 * frames read as iOS Low Power Mode: noted in the readout only, quality is not stepped down.
 *
 * ?perf: a readout (fps, p50/p95, DPR, tier, lamp) sized for a phone screenshot, and
 * window.__boothPerf().
 */
export function PerfProbe({ readout }: { readout: boolean }) {
  const setDpr = useThree((s) => s.setDpr);
  const samples = useRef<{ t: number; ms: number }[]>([]);
  const overSince = useRef<number | null>(null);
  const el = useRef<HTMLDivElement | null>(null);
  const info = perfInfo();

  useEffect(() => {
    perfState.dpr = Math.min(info.dpr, info.dprCap);
    setDpr(perfState.dpr);
  }, [info.dpr, info.dprCap, setDpr]);

  useEffect(() => {
    window.__boothPerf = () => {
      const s = samples.current.map((x) => x.ms).sort((a, b) => a - b);
      const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
      return {
        frames: s.length,
        fps: +(1000 / Math.max(avg, 0.001)).toFixed(1),
        p50Ms: +pct(s, 0.5).toFixed(2),
        p95Ms: +pct(s, 0.95).toFixed(2),
        worstMs: +(s[s.length - 1] ?? 0).toFixed(2),
        dpr: perfState.dpr,
        tier: info.tier + (info.forced ? ' (forced)' : ''),
        lamp: useBooth.getState().lamp,
        lowPower: perfState.lowPower,
        cores: info.cores,
        renderer: info.renderer,
      };
    };
    if (!readout) return;
    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:99;font:600 15px/1.35 ui-monospace,monospace;background:#000d;color:#9f9;padding:10px 12px;border-radius:4px;pointer-events:none;white-space:pre;max-width:calc(100vw - 16px);overflow:hidden';
    document.body.appendChild(div);
    el.current = div;
    return () => div.remove();
  }, [readout, info]);

  useFrame((_, dt) => {
    const ms = dt * 1000;
    const now = performance.now();
    if (ms > 100) return; // a resume after an on-demand gap, not a frame time
    const list = samples.current;
    list.push({ t: now, ms });
    while (list.length && now - list[0].t > 4000) list.shift();

    // evaluate the last second, twice a second
    if (list.length % 15 === 0) {
      const last = list.filter((x) => now - x.t < 1000).map((x) => x.ms).sort((a, b) => a - b);
      if (last.length >= 20) {
        const p5 = pct(last, 0.05);
        const p50 = pct(last, 0.5);
        const p95 = pct(last, 0.95);
        // Low Power Mode caps at 30fps: deltas cluster tightly at ~33ms, without heavy spikes
        perfState.lowPower = p50 > 30 && p50 < 36.5 && p5 > 28 && p95 < 38;
        if (info.tier === 'mobile' && !perfState.lowPower && p95 > 20) {
          overSince.current ??= now;
          if (now - overSince.current >= 2000 && perfState.dpr > 1) {
            perfState.dpr = Math.max(1, +(perfState.dpr - 0.25).toFixed(2));
            perfState.steps++;
            setDpr(perfState.dpr);
            overSince.current = null;
            list.length = 0;
          }
        } else overSince.current = null;
      }
    }

    if (el.current && list.length % 10 === 0) {
      const r = window.__boothPerf!();
      el.current.textContent =
        `${r.fps} fps   p50 ${r.p50Ms}ms   p95 ${r.p95Ms}ms\n` +
        `DPR ${r.dpr}${perfState.steps ? ` (−${perfState.steps})` : ''}   tier ${r.tier}   lamp ${r.lamp}\n` +
        `${r.cores} cores · ${r.renderer.slice(0, 38)}` +
        (r.lowPower ? '\nlow power mode? (frames pinned ~33ms)' : '');
    }
  });
  return null;
}
