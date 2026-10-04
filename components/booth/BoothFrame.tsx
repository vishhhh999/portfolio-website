'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useBooth } from '@/lib/store';
import { registerFrame } from '@/lib/views';
import { playEvent } from '@/lib/sound';
import { CABINET_FACE } from './staging';
import { BoothFocus } from './BoothFocus';

export type FrameSample = { slug: string; title: string; meta: string };

/**
 * A box in the page layout: the booth camera frames the cabinet into it. Landscape, the cabinet
 * fills the column's width. On phones the box is portrait: the cabinet is cropped and panned
 * sample to sample with a horizontal swipe (or the prev / next buttons).
 */
export function BoothFrame({ samples }: { samples: FrameSample[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const focusSlug = useBooth((s) => s.focusSlug);
  const setFocus = useBooth((s) => s.setFocusSlug);
  const index = Math.max(0, samples.findIndex((s) => s.slug === focusSlug));
  const current = samples[index];

  useEffect(() => (ref.current ? registerFrame(ref.current) : undefined), []);
  // D1: the cabinet's height at the full content width, capped at 78svh and at the room left on the
  // first screen above the floating lamp bar. Wider than the cabinet → the camera centres it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (window.innerWidth < 700) {
        el.style.height = '';
        return;
      }
      const clear = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-clear')) || 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const byWidth = el.clientWidth / (CABINET_FACE.w / CABINET_FACE.h);
      const room = window.innerHeight - top - clear - 14;
      el.style.height = `${Math.round(Math.max(300, Math.min(byWidth, window.innerHeight * 0.78, room)))}px`;
      el.style.maxHeight = 'none';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  // start on the centre sample
  useEffect(() => {
    if (!useBooth.getState().focusSlug && samples.length) setFocus(samples[Math.floor(samples.length / 2)].slug);
  }, [samples, setFocus]);

  const go = (d: number) => {
    const i = Math.min(samples.length - 1, Math.max(0, index + d));
    if (i !== index) playEvent('swipe', d > 0 ? window.innerWidth * 0.7 : window.innerWidth * 0.3);
    setFocus(samples[i].slug);
  };

  // horizontal swipe: vertical drags stay page scroll (touch-action: pan-y)
  const start = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.3) go(dx < 0 ? 1 : -1);
  };

  return (
    <div className="booth-frame-wrap">
      <BoothFocus samples={samples} />
      <div
        ref={ref}
        className="booth-frame"
        style={{ ['--cab-aspect' as string]: `${CABINET_FACE.w} / ${CABINET_FACE.h}` }}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (start.current = null)}
        aria-hidden="true"
      />
      {current && (
        <div className="booth-swipe" aria-label="Samples in the booth">
          <button type="button" className="booth-swipe__btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous sample">
            ←
          </button>
          <Link href={`/work/${current.slug}`} className="booth-swipe__caption">
            <span className="booth-swipe__title">{current.title}</span>
            <span className="mono">
              {String(index + 1).padStart(2, '0')} / {String(samples.length).padStart(2, '0')} · {current.meta}
            </span>
          </Link>
          <button type="button" className="booth-swipe__btn" onClick={() => go(1)} disabled={index === samples.length - 1} aria-label="Next sample">
            →
          </button>
        </div>
      )}
    </div>
  );
}
