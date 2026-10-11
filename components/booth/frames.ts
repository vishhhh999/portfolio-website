'use client';

import { kick } from './activity';

/**
 * The page tells the canvas where to draw. Each frame is a DOM element: the home booth frame, the
 * project header, or one thumbnail in the phone strip. Rects are measured relative to the booth
 * layer (the canvas's own box, which scrolls with the page), so scrolling never needs a redraw.
 */
export type FrameKind = 'home' | 'header' | 'thumb';
export type FrameRect = { x: number; y: number; w: number; h: number };
type Entry = { el: HTMLElement; kind: FrameKind; slug?: string; rect: FrameRect | null; clip?: HTMLElement };

const entries = new Set<Entry>();
const listeners = new Set<() => void>();
let layer: HTMLElement | null = null;
let ro: ResizeObserver | null = null;

export function setLayer(el: HTMLElement | null) {
  layer = el;
  measure();
}

function rectOf(e: Entry): FrameRect | null {
  if (!layer || !e.el.isConnected) return null;
  const base = layer.getBoundingClientRect();
  const r = e.el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
}

export function measure() {
  let bottom = 0;
  for (const e of entries) {
    e.rect = rectOf(e);
    if (e.rect) bottom = Math.max(bottom, e.rect.y + e.rect.h);
  }
  // the layer (and so the canvas) reaches just past the lowest frame, never shorter than the screen
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--booth-h', `${Math.ceil(bottom + 24)}px`);
  listeners.forEach((fn) => fn());
  kick(50);
}

export function registerFrame(el: HTMLElement, kind: FrameKind, slug?: string, clip?: HTMLElement) {
  const e: Entry = { el, kind, slug, rect: null, clip };
  entries.add(e);
  ro ??= new ResizeObserver(() => measure());
  ro.observe(el);
  if (clip) clip.addEventListener('scroll', measure, { passive: true });
  e.rect = rectOf(e);
  measure();
  return () => {
    entries.delete(e);
    ro?.unobserve(el);
    clip?.removeEventListener('scroll', measure);
    measure();
  };
}

/** The main view: the project header if there is one, else the home frame. */
export function mainFrame(): { kind: FrameKind; rect: FrameRect } | null {
  let home: Entry | null = null;
  for (const e of entries) {
    if (e.kind === 'header' && e.rect) return { kind: 'header', rect: e.rect };
    if (e.kind === 'home' && e.rect) home = e;
  }
  return home?.rect ? { kind: 'home', rect: home.rect } : null;
}

/** Thumbnail frames, clipped to their scrolling strip. */
export function thumbFrames(): { slug: string; rect: FrameRect; clip: FrameRect | null }[] {
  const out: { slug: string; rect: FrameRect; clip: FrameRect | null }[] = [];
  for (const e of entries) {
    if (e.kind !== 'thumb' || !e.rect || !e.slug) continue;
    let clip: FrameRect | null = null;
    if (e.clip && layer) {
      const base = layer.getBoundingClientRect();
      const c = e.clip.getBoundingClientRect();
      clip = { x: c.left - base.left, y: c.top - base.top, w: c.width, h: c.height };
    }
    out.push({ slug: e.slug, rect: e.rect, clip });
  }
  return out;
}

export function onFrames(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => measure());
  document.fonts?.ready.then(() => measure());
}
