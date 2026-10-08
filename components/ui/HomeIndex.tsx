'use client';

import Link from 'next/link';
import { useState } from 'react';
import { works } from '@/content/work';
import { track } from '@/lib/analytics';
import { Cover, COVER_ASPECT } from './Cover';

/**
 * C5: the home page's Index view: number, project, discipline, year. Hovering (or focusing) a row
 * shows that project's cover beside the list (I 09: the 18:25 covers, AVIF / WebP in srcset, in a box
 * of the cover's own aspect). Plain DOM, no WebGL.
 */
export function HomeIndex() {
  const [hover, setHover] = useState<string | null>(null);
  const shown = works.find((w) => w.slug === hover) ?? null;
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
      <div className="homeindex__preview" aria-hidden="true" style={{ aspectRatio: `${COVER_ASPECT}`, width: `min(100%, calc(70svh * ${COVER_ASPECT.toFixed(4)}))` }}>
        {works.map((w) => (
          <Cover key={w.slug} slug={w.slug} sizes="(max-width: 760px) 0px, min(40vw, 50svh)" on={shown?.slug === w.slug} />
        ))}
      </div>
    </section>
  );
}
