'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useBooth } from '@/lib/store';
import { registerFrame } from '@/lib/views';
import { playEvent } from '@/lib/sound';
import { CABINET_FACE, PHONE_LAYOUT, STAGING } from './staging';
import { BoothFocus } from './BoothFocus';

export type FrameSample = { slug: string; title: string; meta: string };

/**
 * A box in the page layout: the booth camera frames the cabinet into it. Landscape, the cabinet
 * fills the column's width. On phones the box is portrait: the cabinet is cropped and panned
 * sample to sample with a horizontal swipe (or the prev / next buttons).
 */
export function BoothFrame({ samples: given }: { samples: FrameSample[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // G (08): on phones the swipe follows the phone arrangement, front row first, left to right
  const [samples, setSamples] = useState(given);
  useEffect(() => {
    if (!PHONE_LAYOUT) return setSamples(given);
    const tier = (slug: string) => Math.round(STAGING[slug].z * 4);
    setSamples([...given].sort((a, b) => tier(b.slug) - tier(a.slug) || STAGING[a.slug].x - STAGING[b.slug].x));
  }, [given]);
  const focusSlug = useBooth((s) => s.focusSlug);
  const setFocus = useBooth((s) => s.setFocusSlug);
  const index = Math.max(0, samples.findIndex((s) => s.slug === focusSlug));
  const current = samples[index];

  useEffect(() => (ref.current ? registerFrame(ref.current) : undefined), []);
  // C2: one centred column. The stage is min(content width, cabinet aspect × the height left on the first screen
  // under the headline and above the lamp panel), at the cabinet's own aspect, so the booth and the
  // panel fit in one screen at every size. Phones (< 600px) have their own portrait composition.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (window.innerWidth < 600) {
        el.style.height = el.style.width = '';
        return;
      }
      const wrap = el.parentElement!;
      const slot = document.getElementById('panel-slot');
      const panelH = slot ? Math.max(56, slot.getBoundingClientRect().height) + 14 : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const avail = window.innerHeight - top - panelH - 18;
      // A4 (08): the box takes the cabinet's own aspect, so the slimmer header band goes to the interior
      const aspect = CABINET_FACE.w / CABINET_FACE.h;
      const w = Math.max(280, Math.min(wrap.clientWidth, aspect * avail));
      el.style.width = `${Math.round(w)}px`;
      el.style.height = `${Math.round(w / aspect)}px`;
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
      >
        {/* C1 (08): the LCP poster is this exact cabinet shot, rendered from the current staging
            (tools/make-posters.mjs; the build refuses a stale one), so the crossfade never jumps */}
        <picture className="booth-poster">
          <source media="(max-width: 599px)" srcSet="/booth/poster-phone.webp" type="image/webp" />
          <source srcSet="/booth/poster-cabinet-1200.webp 1200w, /booth/poster-cabinet-2400.webp 2400w" sizes="min(100vw, 1800px)" type="image/webp" />
          <img src="/booth/poster-cabinet-1200.jpg" alt="" fetchPriority="high" decoding="async" />
        </picture>
      </div>
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
