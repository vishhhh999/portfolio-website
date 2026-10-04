'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { FrameSample } from './BoothFrame';
import { focusRects, onFocusRects } from './focus';
import { useBooth } from '@/lib/store';
import { playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { openProject, warmProject } from '@/lib/navigate';

/**
 * The keyboard layer over the booth (I5): one real button per object, laid exactly over it, so the
 * canvas stays presentational while every sample is focusable with a visible focus ring. Focus lifts
 * the object and shows its spec chip (like a hover); Enter opens the project; ← → move between
 * samples in lineup order (and pan the phone crop).
 */
export function BoothFocus({ samples }: { samples: FrameSample[] }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const router = useRouter();
  const setKeySlug = useBooth((s) => s.setKeySlug);

  useEffect(() => {
    const place = () => {
      for (const [slug, el] of refs.current) {
        const r = focusRects.get(slug);
        if (!r) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = '';
        el.style.transform = `translate(${r.x - 6}px, ${r.y - 6}px)`;
        el.style.width = `${r.w + 12}px`;
        el.style.height = `${r.h + 12}px`;
      }
    };
    place();
    return onFocusRects(place);
  }, []);

  const go = (from: number, d: number) => {
    const i = (from + d + samples.length) % samples.length;
    const next = samples[i];
    refs.current.get(next.slug)?.focus();
    useBooth.getState().setFocusSlug(next.slug);
  };

  return (
    <div className="booth-focus" role="group" aria-label="Samples in the booth">
      {samples.map((s, i) => (
        <button
          key={s.slug}
          ref={(el) => {
            if (el) refs.current.set(s.slug, el);
            else refs.current.delete(s.slug);
          }}
          type="button"
          className="booth-focus__item"
          data-slug={s.slug}
          aria-label={`${s.title}: ${s.meta}. Open the project`}
          onFocus={(e) => {
            setKeySlug(s.slug);
            warmProject(router, s.slug);
            const r = e.currentTarget.getBoundingClientRect();
            playEvent('hover', r.left + r.width / 2);
          }}
          onBlur={() => setKeySlug(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              go(i, 1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              go(i, -1);
            }
          }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            playEvent('select', r.left + r.width / 2);
            track('Project opened', { slug: s.slug, from: 'booth (keyboard)' });
            openProject(router, `/work/${s.slug}`);
          }}
          // pointer users click the canvas itself; this layer only takes keyboard focus
          tabIndex={0}
        />
      ))}
    </div>
  );
}
