'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ARCHIVE_CATEGORIES, type ArchiveCategory, type ArchivePiece } from '@/content/archive';
import { playEvent } from '@/lib/sound';

/** Column width: 4 columns on desktop, 2 on phones (globals.css .archive). */
const SIZES = '(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 25vw';
/** The 480w/960w copies from tools/archive-sizes.mjs: /archive/07.webp → /archive/sized/07-480.avif … */
const sized = (src: string, ext: 'avif' | 'webp') => {
  const base = src.replace(/^\/archive\/(.+)\.webp$/, '/archive/sized/$1');
  return `${base}-480.${ext} 480w, ${base}-960.${ext} 960w`;
};

/** The filter chips (G3); the value is kept in ?series= so a filtered view can be linked. */
type Chip = { id: 'all' | ArchiveCategory; label: string };

/**
 * The archive contact sheet: every piece, lazy-loaded, at its real aspect ratio. One row of chips
 * filters by kind, kept in the URL.
 */
export function ArchiveGrid({ pieces }: { pieces: ArchivePiece[] }) {
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
  return <ArchiveView pieces={pieces} current={params.get('series') ?? 'all'} onSet={set} />;
}

/** G2: a clip loops, muted, only while it is on screen; its poster is sized to the column. */
function Clip({ p }: { p: ArchivePiece }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [poster, setPoster] = useState(p.poster!.replace(/\.webp$/, '-480.webp'));
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (v.clientWidth * (window.devicePixelRatio || 1) > 520) setPoster(p.poster!);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !reduced) void v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [p.poster]);
  return (
    <video ref={ref} poster={poster} muted loop playsInline preload="none" aria-label={p.alt} width={p.width} height={p.height}>
      {p.sources?.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
      <source src={p.src} type="video/mp4" />
    </video>
  );
}

/** The grid itself; also the server-rendered, unfiltered fallback (no onSet: the chips are inert until hydrated). */
export function ArchiveView({ pieces, current = 'all', onSet }: { pieces: ArchivePiece[]; current?: string; onSet?: (value: string) => void }) {
  const chips: Chip[] = [{ id: 'all', label: 'All' }, ...ARCHIVE_CATEGORIES];
  const shown = pieces.filter((p) => current === 'all' || p.category === current);
  const count = (id: Chip['id']) => (id === 'all' ? pieces.length : pieces.filter((p) => p.category === id).length);
  return (
    <>
      <div className="archive__filters" role="group" aria-label="Filter the archive">
        <ul className="chips" role="list">
          {chips.map((c) => (
            <li key={c.id}>
              <button type="button" className="chip" aria-pressed={current === c.id} onClick={() => onSet?.(c.id)}>
                {c.label} <span className="chip__n">{count(c.id)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mono archive__count" aria-live="polite">
          {shown.length} of {pieces.length}
        </p>
      </div>

      <ol className="archive">
        {shown.map((p, i) => (
          <li key={p.src} id={`a${String(p.no).padStart(2, '0')}`} className="archive__item">
            <figure className="archive__fig">
              <span className="archive__frame" style={{ aspectRatio: `${p.width ?? 1} / ${p.height ?? 1}` }}>
                {p.type === 'video' ? (
                  <Clip p={p} />
                ) : (
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
                )}
              </span>
              <figcaption className="archive__caption mono">
                <span className="archive__no">A{String(p.no).padStart(2, '0')}</span> {p.title}
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </>
  );
}
