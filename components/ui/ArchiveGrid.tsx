'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ARCHIVE_CATEGORIES, type ArchiveCategory, type ArchivePiece } from '@/content/archive';
import { playEvent } from '@/lib/sound';
import LQIP from '@/content/archive-lqip.json';

/** P11 (09): a tile's dominant colour and 16px blur-up, shown until its image arrives. */
const lqip = (p: ArchivePiece) => (LQIP as Record<string, { c: string; q: string }>)[p.type === 'video' ? p.poster ?? '' : p.src];
const tag = (p: ArchivePiece) => `A${String(p.no).padStart(2, '0')}`;

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
  const current = params.get('series') ?? 'all';
  const shown = pieces.filter((p) => current === 'all' || p.category === current);
  return (
    <>
      <ArchiveView pieces={pieces} current={current} onSet={set} onOpen={(p) => window.dispatchEvent(new CustomEvent('archive:open', { detail: p.src }))} />
      <ArchiveLightbox pieces={shown} />
    </>
  );
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
export function ArchiveView({ pieces, current = 'all', onSet, onOpen }: { pieces: ArchivePiece[]; current?: string; onSet?: (value: string) => void; onOpen?: (p: ArchivePiece) => void }) {
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
              <span
                className="archive__frame"
                style={{ aspectRatio: `${p.width ?? 1} / ${p.height ?? 1}`, backgroundColor: lqip(p)?.c, backgroundImage: lqip(p) ? `url(${lqip(p)!.q})` : undefined }}
              >
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
                <span className="archive__no">{tag(p)}</span> {p.title}
              </figcaption>
              {/* P11 (09): the whole tile opens the viewer (click, Enter or Space) */}
              <button type="button" className="archive__open" aria-label={`View ${tag(p)}, ${p.title}`} onClick={() => onOpen?.(p)} />
            </figure>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * P11 (09): the archive viewer. Click or Enter on a tile opens it; ← → (and a swipe) move through the
 * pieces shown; Esc closes; focus stays inside (a modal <dialog>); the URL hash names the piece (#A07),
 * so a link opens straight onto it. The images are the plain files.
 */
export function ArchiveLightbox({ pieces }: { pieces: ArchivePiece[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState<number | null>(null);
  const open = (i: number | null) => setAt(i);
  useEffect(() => {
    const fromHash = () => {
      const m = /^#A(\d{2})$/i.exec(window.location.hash);
      const i = m ? pieces.findIndex((p) => p.no === +m[1]) : -1;
      setAt(i >= 0 ? i : null);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    const onOpen = (e: Event) => {
      const i = pieces.findIndex((p) => p.src === (e as CustomEvent<string>).detail);
      if (i >= 0) setAt(i);
    };
    window.addEventListener('archive:open', onOpen);
    return () => {
      window.removeEventListener('hashchange', fromHash);
      window.removeEventListener('archive:open', onOpen);
    };
  }, [pieces]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (at !== null) {
      if (!d.open) d.showModal();
      const h = `#${tag(pieces[at])}`;
      if (window.location.hash !== h) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${h}`);
    } else {
      if (d.open) d.close();
      if (window.location.hash) history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, [at, pieces]);
  const step = (d: number) => setAt((i) => (i === null ? i : (i + d + pieces.length) % pieces.length));
  const touch = useRef<number | null>(null);
  const p = at !== null ? pieces[at] : null;
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={p ? `${tag(p)}, ${p.title}` : 'Archive viewer'}
      onClose={() => open(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') (e.preventDefault(), step(1));
        if (e.key === 'ArrowLeft') (e.preventDefault(), step(-1));
      }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const x0 = touch.current;
        touch.current = null;
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }}
      onClick={(e) => {
        if (e.target === ref.current) open(null);
      }}
    >
      {p && (
        <figure className="lightbox__fig">
          {p.type === 'video' ? (
            <video key={p.src} src={p.src} poster={p.poster} muted loop playsInline autoPlay controls aria-label={p.alt} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.src} src={p.src} alt={p.alt} width={p.width} height={p.height} />
          )}
          <figcaption className="lightbox__bar">
            <span className="mono">
              {tag(p)} · {at! + 1} / {pieces.length}
            </span>
            <span className="lightbox__title">{p.title}</span>
            <span className="lightbox__nav">
              <button type="button" className="lightbox__btn" onClick={() => step(-1)} aria-label="Previous piece">
                ←
              </button>
              <button type="button" className="lightbox__btn" onClick={() => step(1)} aria-label="Next piece">
                →
              </button>
              <button type="button" className="lightbox__btn" onClick={() => open(null)} aria-label="Close the viewer" autoFocus>
                ✕
              </button>
            </span>
          </figcaption>
        </figure>
      )}
    </dialog>
  );
}
