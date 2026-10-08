'use client';

/**
 * The view system for the one fixed, full-screen, transparent canvas.
 *
 * A "view" is a DOM element whose rectangle the canvas draws into:
 *   - the booth stage (home: full screen; project pages: the 70svh header)
 *   - proof-strip planes (one per deliverable image/video)
 *
 * Layout is cached in document coordinates (measured on mount, resize, image
 * load and body-size changes), so per-frame positions are just
 * `docTop − scroll`: no layout reads during scroll, and the scroll value is
 * the same Lenis value the page was moved with, on the same tick. Zero drift.
 */

export type DocRect = { left: number; top: number; width: number; height: number };
export type ViewSnapshot = { stage: DocRect | null; frame: DocRect | null; width: number; height: number };
let snapshot: ViewSnapshot | null = null;

/** Reproduce a prior rendered view for the resize cover without reading the new DOM layout. */
export function withViewSnapshot(view: ViewSnapshot, draw: () => void) {
  const previous = snapshot;
  snapshot = view;
  try { draw(); } finally { snapshot = previous; }
}
export const viewportSize = () => snapshot ? { width: snapshot.width, height: snapshot.height } : { width: window.innerWidth, height: window.innerHeight };

export type PlaneSpec = {
  el: HTMLImageElement | HTMLVideoElement;
  kind: 'image' | 'video';
  src: string;
  fluorMask?: string;
  uvInk?: string;
  /** Approved notes drawn as UV ink on this photo. */
  inkNotes?: { text: string; at: [number, number] }[];
  /** Called once the plane has drawn, so the DOM element can be visually hidden. */
  onReady?: () => void;
};

type Entry = { el: HTMLElement; rect: DocRect };

let stage: Entry | null = null;
/** Where the booth cabinet should sit on the page (home): the camera frames the cabinet into this box. */
let frame: Entry | null = null;
const planes = new Map<number, PlaneSpec & { rect: DocRect }>();
let nextId = 1;
let scrollY = 0;
const listeners = new Set<() => void>();
let ro: ResizeObserver | null = null;

const docRect = (el: HTMLElement): DocRect => {
  const r = el.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
};

/** Re-measure every registered element (cheap: a handful of rects). */
export function measure() {
  if (stage) stage.rect = docRect(stage.el);
  if (frame) frame.rect = docRect(frame.el);
  for (const p of planes.values()) p.rect = docRect(p.el);
  scrollY = window.scrollY;
  changed();
}

function changed() {
  listeners.forEach((l) => l());
}

/** Notified when views are added/removed or re-measured: the canvas should draw a frame. */
export function onViewsChanged(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/**
 * Every rect is re-derived from the live DOM whenever anything could move it: the body or any
 * registered element resizing, the window resizing (including a scrollbar appearing, which
 * changes clientWidth but not innerWidth), and web fonts finishing loading (the headline
 * re-wraps and pushes the booth frame down).
 */
function ensureObserver() {
  if (ro || typeof ResizeObserver === 'undefined') return;
  ro = new ResizeObserver(() => measure());
  ro.observe(document.body);
  window.addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
  // a page loaded in a hidden tab was laid out (and drawn) before it was ever seen: re-measure,
  // which also requests a frame, the moment it becomes visible
  document.addEventListener('visibilitychange', () => !document.hidden && measure());
  window.addEventListener('pageshow', measure);
  document.fonts?.addEventListener?.('loadingdone', measure);
}
const observe = (el: HTMLElement) => {
  ro?.observe(el);
  return () => ro?.unobserve(el);
};

export function registerStage(el: HTMLElement) {
  ensureObserver();
  stage = { el, rect: docRect(el) };
  const off = observe(el);
  changed();
  return () => {
    off();
    if (stage?.el === el) stage = null;
    changed();
  };
}

export function registerFrame(el: HTMLElement) {
  ensureObserver();
  frame = { el, rect: docRect(el) };
  const off = observe(el);
  changed();
  return () => {
    off();
    if (frame?.el === el) frame = null;
    changed();
  };
}

/** Cabinet frame box in viewport CSS px, or null (project pages frame the tray instead). */
export function frameRect() {
  if (snapshot) return snapshot.frame;
  return frame ? toViewport(frame.rect) : null;
}

export function registerPlane(spec: PlaneSpec) {
  ensureObserver();
  const id = nextId++;
  planes.set(id, { ...spec, rect: docRect(spec.el) });
  const onLoad = () => measure();
  spec.el.addEventListener('load', onLoad);
  spec.el.addEventListener('loadedmetadata', onLoad);
  changed();
  return () => {
    spec.el.removeEventListener('load', onLoad);
    spec.el.removeEventListener('loadedmetadata', onLoad);
    planes.delete(id);
    changed();
  };
}

/** The scroll value the page was positioned with this tick (set by the clock right after Lenis). */
export function setScroll(y: number) {
  scrollY = y;
}
export const getScroll = () => scrollY;

// the page's real scroll at this moment (the clock's copy can lag a programmatic jump by a tick)
const toViewport = (r: DocRect) => ({ left: r.left - window.scrollX, top: r.top - window.scrollY, width: r.width, height: r.height });

/** Booth stage rect in viewport CSS px, or null when there is no stage. */
export function stageRect() {
  if (snapshot) return snapshot.stage;
  return stage ? toViewport(stage.rect) : null;
}
export const hasStage = () => stage !== null;

export function planeEntries() {
  return planes;
}
export function planeRect(id: number) {
  const p = planes.get(id);
  return p ? toViewport(p.rect) : null;
}

const vh = () => window.innerHeight;
const intersects = (r: { top: number; height: number }) => r.top < vh() && r.top + r.height > 0;

/** Is any view on screen right now? (Otherwise the canvas skips rendering entirely.) */
export function anyViewVisible() {
  const s = stageRect();
  if (s && intersects(s)) return true;
  for (const p of planes.values()) if (intersects(toViewport(p.rect))) return true;
  return false;
}

export function anyVideoVisible() {
  for (const p of planes.values()) if (p.kind === 'video' && intersects(toViewport(p.rect))) return true;
  return false;
}

export const viewCount = () => (stage ? 1 : 0) + planes.size;

declare global {
  interface Window {
    /** Every registered view in viewport CSS px (tools/check-smear.mjs). */
    __boothViews?: () => { kind: string; left: number; top: number; width: number; height: number }[];
  }
}

if (typeof window !== 'undefined') {
  window.__boothViews = () => {
    const out: { kind: string; left: number; top: number; width: number; height: number }[] = [];
    const s = stageRect();
    if (s) out.push({ kind: 'stage', ...s });
    for (const id of planes.keys()) out.push({ kind: 'plane', ...planeRect(id)! });
    return out;
  };
  window.__boothStageRect = () => {
    const r = stageRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    return new DOMRect(r.left, r.top, r.width, r.height);
  };
}
