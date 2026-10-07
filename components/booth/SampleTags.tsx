'use client';

import { useEffect, useRef } from 'react';
import { lineup } from '@/content/work';
import { useBooth } from '@/lib/store';
import { focusRects, onFocusRects } from './focus';
import type { FrameSample } from './BoothFrame';

/** The lamps that light nothing should not light labels either. */
const DARK = new Set(['UV', 'SCREEN', 'AFTERDARK']);

/**
 * P10 (09): small engraved-style mono tags on the home booth ("01 TOO YUMM"), one under each sample,
 * placed from the samples' projected boxes (DOM, not WebGL), fading in after the reveal. They give a
 * recruiter the project names without hovering. Desktop and tablet-wide layouts only; hidden under
 * UV, SCREEN and AFTER DARK, in house lights, in the Index view, and wherever two would overlap
 * (the later one in lineup order drops out). Decorative: the keyboard layer carries the names.
 */
export function SampleTags({ samples }: { samples: FrameSample[] }) {
  const lamp = useBooth((s) => s.lamp);
  const refs = useRef(new Map<string, HTMLSpanElement>());
  useEffect(() => {
    const place = () => {
      const taken: DOMRect[] = [];
      for (const s of [...samples].sort((a, b) => lineup.findIndex((w) => w.slug === a.slug) - lineup.findIndex((w) => w.slug === b.slug))) {
        const el = refs.current.get(s.slug);
        const r = focusRects.get(s.slug);
        if (!el) continue;
        if (!r) {
          el.dataset.on = 'false';
          continue;
        }
        el.style.transform = `translate(${Math.round(r.x + r.w / 2)}px, ${Math.round(r.y + r.h + 8)}px) translateX(-50%)`;
        const box = el.getBoundingClientRect();
        const clash = taken.some((t) => box.left < t.right + 6 && box.right > t.left - 6 && box.top < t.bottom + 2 && box.bottom > t.top - 2);
        el.dataset.on = String(!clash);
        if (!clash) taken.push(box);
      }
    };
    place();
    return onFocusRects(place);
  }, [samples]);
  return (
    <div className="sampletags" aria-hidden="true" data-dark={DARK.has(lamp)}>
      {samples.map((s) => {
        const n = lineup.findIndex((w) => w.slug === s.slug) + 1;
        return (
          <span
            key={s.slug}
            ref={(el) => {
              if (el) refs.current.set(s.slug, el);
              else refs.current.delete(s.slug);
            }}
            className="sampletag mono"
            data-on="false"
          >
            {String(n).padStart(2, '0')} {s.title}
          </span>
        );
      })}
    </div>
  );
}
