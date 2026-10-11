'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { isInLineup, lineup } from '@/content/work';
import { useBooth } from '@/lib/store';
import { gpuTier } from '@/lib/gpuTier';
import { autoHouseLights } from '@/lib/resilience';
import { KEY_STEP, nudgeSpin, resetSpins, setSpinDragging, spinOf, RAD_PER_PX, DRAG_PX } from '@/lib/spin';
import { cabinetFace, LAYOUTS, WIDE_LAYOUT } from './composition';
import { registerFrame, setLayer } from './frames';
import { onBoxes } from './boxes';
import { kick } from './activity';

const BoothCanvas = dynamic(() => import('./BoothCanvas'), { ssr: false });

/** Wide screens get the wide booth; tall screens the portrait booth and, on project pages, the strip. */
export const TALL_QUERY = '(max-aspect-ratio: 11/10)';
const WIDE_FACE = cabinetFace(LAYOUTS[WIDE_LAYOUT]);
const TALL_FACE = cabinetFace(LAYOUTS.grid);
/** The project header's view: the opening (wide), the tray close up (tall). */
const OPENING_ASPECT = (LAYOUTS[WIDE_LAYOUT].room.w - 0.08) / (LAYOUTS[WIDE_LAYOUT].room.h - 0.06);

export const frameAspects = {
  homeWide: WIDE_FACE.w / WIDE_FACE.h,
  homeTall: TALL_FACE.w / TALL_FACE.h,
  workWide: OPENING_ASPECT,
  workTall: 1.18,
};

export function boothMode(pathname: string): 'home' | 'work' | 'off' {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/work/') && isInLineup(pathname.split('/')[2] ?? '')) return 'work';
  return 'off';
}

const meta = (slug: string) => {
  const w = lineup.find((x) => x.slug === slug)!;
  return { title: w.title, line: `${w.disciplines.join(', ')} · ${w.year}` };
};

/**
 * The booth layer: a box at the top of the page that scrolls with it, holding the one canvas (lazy,
 * after first paint, never remounted across routes) and the links laid over each object.
 */
export function BoothLayer() {
  const pathname = usePathname();
  const mode = boothMode(pathname);
  const houseLights = useBooth((s) => s.houseLights);
  const setActiveSlug = useBooth((s) => s.setActiveSlug);
  const [mounted, setMounted] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const live = mode !== 'off' && !houseLights;

  useEffect(() => {
    setActiveSlug(mode === 'work' ? pathname.split('/')[2] : null);
    useBooth.getState().setHoverSlug(null);
    resetSpins();
    kick(100);
  }, [pathname, mode, setActiveSlug]);

  useEffect(() => {
    setLayer(layer.current);
    return () => setLayer(null);
  }, []);

  useEffect(() => {
    if (mounted || !live) return;
    if (gpuTier() === 'low') {
      autoHouseLights('speed');
      return;
    }
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    const id = idle(() => setMounted(true), { timeout: 600 });
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, [live, mounted]);

  return (
    <div ref={layer} className="booth-layer" data-live={live} aria-hidden={false}>
      <div className="booth-layer__canvas" aria-hidden="true">
        {mounted && (
          <BoothCanvas
            onReady={() => {
              document.documentElement.setAttribute('data-booth-ready', '');
            }}
          />
        )}
      </div>
      {live && <ObjectLinks mode={mode} />}
    </div>
  );
}

/**
 * Real links over the objects: hover or focus lifts an object and shows its spec chip; click or
 * Enter opens its page (a client-side route change: the canvas stays, the object slides to the
 * tray). On a project page the object on the tray is a turntable: drag it, or focus it and use
 * the arrow keys.
 */
function ObjectLinks({ mode }: { mode: 'home' | 'work' }) {
  const refs = useRef(new Map<string, HTMLElement>());
  const chip = useRef<HTMLDivElement>(null);
  const activeSlug = useBooth((s) => s.activeSlug);
  const hoverSlug = useBooth((s) => s.hoverSlug);
  const setHover = useBooth((s) => s.setHoverSlug);
  const boxesRef = useRef<Map<string, { x: number; y: number; w: number; h: number; top: number }>>(new Map());

  useEffect(
    () =>
      onBoxes((boxes) => {
        boxesRef.current = boxes;
        for (const [slug, el] of refs.current) {
          const b = boxes.get(slug);
          if (!b) {
            el.style.visibility = 'hidden';
            continue;
          }
          el.style.visibility = 'visible';
          el.style.transform = `translate(${b.x}px, ${b.y}px)`;
          el.style.width = `${b.w}px`;
          el.style.height = `${b.h}px`;
        }
        placeChip();
      }),
    [],
  );
  const placeChip = () => {
    const c = chip.current;
    if (!c) return;
    const slug = useBooth.getState().hoverSlug;
    const b = slug ? boxesRef.current.get(slug) : null;
    if (!b || !slug) {
      c.dataset.on = 'false';
      return;
    }
    c.dataset.on = 'true';
    c.style.transform = `translate(${Math.round(b.x + b.w / 2)}px, ${Math.round(Math.min(b.top, b.y) - 10)}px)`;
  };
  useEffect(placeChip, [hoverSlug]);

  // the chip keeps its last words while it fades out
  const last = useRef<string | null>(null);
  if (hoverSlug) last.current = hoverSlug;
  const hovered = last.current ? meta(last.current) : null;
  return (
    <div className="booth-links">
      {lineup.map((w) => {
        const isActive = w.slug === activeSlug;
        const label = `${w.title}, ${w.disciplines.join(', ')}, ${w.year}`;
        const common = {
          ref: (el: HTMLElement | null) => {
            if (el) refs.current.set(w.slug, el);
            else refs.current.delete(w.slug);
          },
          className: 'booth-link',
          style: { visibility: 'hidden' as const },
          onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setHover(w.slug),
          onPointerLeave: () => useBooth.getState().hoverSlug === w.slug && setHover(null),
          onFocus: () => setHover(w.slug),
          onBlur: () => useBooth.getState().hoverSlug === w.slug && setHover(null),
        };
        if (isActive) return <TrayHandle key={w.slug} slug={w.slug} title={w.title} common={common} />;
        return (
          <Link key={w.slug} href={`/work/${w.slug}`} aria-label={`Open ${label}`} {...common} data-mode={mode} />
        );
      })}
      <div ref={chip} className="specchip" data-on="false" aria-hidden="true">
        {hovered && (
          <>
            <span className="specchip__title">{hovered.title}</span>
            <span className="specchip__meta">{hovered.line}</span>
          </>
        )}
      </div>
    </div>
  );
}

type Common = {
  ref: (el: HTMLElement | null) => void;
  className: string;
  style: React.CSSProperties;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

/** The object on the tray: drag to turn it (with a little inertia), or arrow keys 15 degrees a press. */
function TrayHandle({ slug, title, common }: { slug: string; title: string; common: Common }) {
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  return (
    <div
      {...common}
      className="booth-link booth-link--tray"
      role="slider"
      tabIndex={0}
      aria-label={`${title} on the tray. Drag, or use the left and right arrow keys, to turn it`}
      aria-valuetext="Turntable"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, t: performance.now(), moved: false };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) < DRAG_PX) return;
        d.moved = true;
        setSpinDragging(slug);
        const s = spinOf(slug);
        const now = performance.now();
        s.target = null;
        s.yaw += dx * RAD_PER_PX;
        s.v = (dx * RAD_PER_PX) / Math.max(0.008, (now - d.t) / 1000);
        d.x = e.clientX;
        d.t = now;
        kick(600);
      }}
      onPointerUp={() => {
        drag.current = null;
        setSpinDragging(null);
        kick(1500);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        nudgeSpin(slug, e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP);
        kick(600);
      }}
    />
  );
}

/** The home booth's frame: the camera fits the cabinet's face into it exactly, so the poster matches. */
export function BoothFrame() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? registerFrame(ref.current, 'home') : undefined), []);
  return (
    <>
    <div
      ref={ref}
      className="booth-frame"
      style={{ ['--wide' as string]: frameAspects.homeWide, ['--tall' as string]: frameAspects.homeTall }}
      aria-hidden="true"
    >
      <picture className="booth-poster">
        <source media={TALL_QUERY} srcSet="/booth/poster-home-tall.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/booth/poster-home-wide.webp" alt="" fetchPriority="high" decoding="async" />
      </picture>
    </div>
    <LampSlot />
    </>
  );
}

/** Where the lamp bar docks: directly under the booth. */
const LampSlot = () => <div id="lamp-slot" className="lamp-slot" />;

/**
 * A project's booth header. Wide screens: the whole booth, the project's object forward on the tray,
 * the other eight in their places, every one clickable. Tall screens: the tray close up, and a strip
 * below with each of the other eight drawn live in its own small view.
 */
export function WorkStage({ slug }: { slug: string }) {
  const view = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => (view.current ? registerFrame(view.current, 'header') : undefined), []);
  const others = lineup.filter((w) => w.slug !== slug);
  return (
    <div className="work-stage" style={{ ['--wide' as string]: frameAspects.workWide, ['--tall' as string]: frameAspects.workTall }}>
      <div ref={view} className="work-stage__view" aria-hidden="true">
        <picture className="booth-poster">
          <source media={TALL_QUERY} srcSet={`/booth/poster-${slug}-tall.webp`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/booth/poster-${slug}-wide.webp`} alt="" fetchPriority="high" decoding="async" />
        </picture>
      </div>
      <LampSlot />
      <nav ref={strip} className="work-strip" aria-label="Other projects in the booth">
        {others.map((w) => (
          <Thumb key={w.slug} slug={w.slug} title={w.title} strip={strip} />
        ))}
      </nav>
    </div>
  );
}

function Thumb({ slug, title, strip }: { slug: string; title: string; strip: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !strip.current) return;
    const mq = window.matchMedia(TALL_QUERY);
    let off: (() => void) | null = null;
    const sync = () => {
      off?.();
      off = mq.matches ? registerFrame(el, 'thumb', slug, strip.current!) : null;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      off?.();
      mq.removeEventListener('change', sync);
    };
  }, [slug, strip]);
  return (
    <Link href={`/work/${slug}`} className="work-strip__item">
      <span ref={ref} className="work-strip__view" aria-hidden="true" />
      <span className="work-strip__name">{title}</span>
    </Link>
  );
}
