'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ArchivePiece, ArchiveSeries } from '@/content/archive';
import { playEvent } from '@/lib/sound';

/** Column width: 4 columns on desktop, 2 on phones (globals.css .archive). */
const SIZES = '(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 25vw';
/** The 480w/960w copies from tools/archive-sizes.mjs: /archive/07.webp → /archive/sized/07-480.avif … */
const sized = (src: string, ext: 'avif' | 'webp') => {
  const base = src.replace(/^\/archive\/(.+)\.webp$/, '/archive/sized/$1');
  return `${base}-480.${ext} 480w, ${base}-960.${ext} 960w`;
};

/**
 * The archive contact sheet: every piece, lazy-loaded, at its real aspect ratio.
 * One filter (the series), kept in the URL so a filtered view can be linked.
 */
export function ArchiveGrid({ pieces, series }: { pieces: ArchivePiece[]; series: ArchiveSeries[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete('series');
    else next.set('series', value);
    const q = next.toString();
    playEvent('loupe');
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  return <ArchiveView pieces={pieces} series={series} current={params.get('series') ?? 'all'} onSet={set} />;
}

/** The grid itself; also the server-rendered, unfiltered fallback (no onSet: the filter is inert until hydrated). */
export function ArchiveView({
  pieces,
  series,
  current = 'all',
  onSet,
}: {
  pieces: ArchivePiece[];
  series: ArchiveSeries[];
  current?: string;
  onSet?: (value: string) => void;
}) {
  const shown = pieces.filter((p) => current === 'all' || p.series.id === current);
  const count = (id: string) => pieces.filter((p) => p.series.id === id).length;
  return (
    <>
      <div className="archive__filters" role="group" aria-label="Filter the archive">
        <label>
          <span className="mono">Series</span>
          <select value={current} onChange={(e) => onSet?.(e.target.value)}>
            <option value="all">Everything ({pieces.length})</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({count(s.id)})
              </option>
            ))}
          </select>
        </label>
        <p className="mono archive__count" aria-live="polite">
          {shown.length} of {pieces.length}
        </p>
      </div>

      <ol className="archive">
        {shown.map((p, i) => (
          <li key={p.n} id={`a${String(p.n).padStart(2, '0')}`} className="archive__item">
            <figure className="archive__fig">
              <span className="archive__frame" style={{ aspectRatio: `${p.width ?? 1} / ${p.height ?? 1}` }}>
                <picture>
                  <source srcSet={sized(p.src, 'avif')} sizes={SIZES} type="image/avif" />
                  <source srcSet={sized(p.src, 'webp')} sizes={SIZES} type="image/webp" />
                  {/* the first row is above the fold: no lazy loading, so it is the fast LCP */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt={p.alt}
                    width={p.width}
                    height={p.height}
                    loading={i < 4 ? 'eager' : 'lazy'}
                    fetchPriority={i < 2 ? 'high' : undefined}
                    decoding="async"
                  />
                </picture>
              </span>
              <figcaption className="archive__caption mono">
                A{String(p.n).padStart(2, '0')} · {p.series.label}
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </>
  );
}
