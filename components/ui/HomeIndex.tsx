'use client';

import Link from 'next/link';
import { useState } from 'react';
import { works } from '@/content/work';
import { sizedFile } from '@/lib/responsive';
import { track } from '@/lib/analytics';
import type { Work } from '@/lib/types';

/** A project's first still (a video's poster), at the smallest generated width ≥ 640px. */
function still(w: Work) {
  const d = w.deliverables[0];
  if (!d) return null;
  const src = d.type === 'video' ? d.poster : d.src;
  return src ? sizedFile(src, 640) : null;
}

/** H4 (08): the still's own aspect (width / height), so the preview box never letterboxes it. */
function aspect(w: Work) {
  const d = w.deliverables[0];
  return d?.width && d?.height ? d.width / d.height : 4 / 3;
}

/**
 * C5: the home page's Index view: number, project, discipline, year. Hovering (or focusing) a row
 * shows that project's first image beside the list. Plain DOM, no WebGL.
 */
export function HomeIndex() {
  const [hover, setHover] = useState<string | null>(null);
  const shown = works.find((w) => w.slug === hover) ?? null;
  // the box keeps the last shown still's aspect while it fades out
  const [last, setLast] = useState<Work | null>(null);
  if (shown && shown !== last) setLast(shown);
  const a = aspect(shown ?? last ?? works[0]);
  return (
    <section className="homeindex" aria-label="Index">
      <ol className="homeindex__list">
        {works.map((w, i) => (
          <li key={w.slug}>
            <Link
              href={`/work/${w.slug}`}
              onPointerEnter={() => setHover(w.slug)}
              onPointerLeave={() => setHover((h) => (h === w.slug ? null : h))}
              onFocus={() => setHover(w.slug)}
              onBlur={() => setHover(null)}
              onClick={() => track('Project opened', { slug: w.slug, from: 'index' })}
            >
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="homeindex__title">{w.title}</span>
              <span className="homeindex__tags">{w.disciplines.join(' · ')}</span>
              <span className="mono">{w.year}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="homeindex__preview" aria-hidden="true" style={{ aspectRatio: `${a}`, width: `min(100%, calc(70svh * ${a.toFixed(4)}))` }}>
        {works.map((w) => {
          const src = still(w);
          return src ? <img key={w.slug} src={src} alt="" loading="lazy" decoding="async" data-on={shown?.slug === w.slug} /> : null;
        })}
      </div>
    </section>
  );
}
