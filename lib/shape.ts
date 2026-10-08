import { create } from 'zustand';

/**
 * L1 (09B): the layout is chosen by the SHAPE of the visible page, not by the device.
 *
 * Measured the way the browser presents it: the visual viewport's width and the SMALL viewport
 * height (100svh: the height with the mobile toolbars shown), so a toolbar collapsing while the page
 * scrolls never changes the answer.
 *
 *   tall             aspect < 0.88   every phone portrait, iPad Pro portrait in Safari (about 0.82 to 0.84)
 *   square           0.88 to 1.3     small laptops with tall windows, a portrait tablet with its bars hidden
 *   wide             aspect ≥ 1.3    desktops, landscape tablets
 *   phone-landscape  wide, and the svh height under 480px: the headline joins the masthead row, the
 *                    booth takes the full height, the lamp panel is a slim rail
 *
 * A layout only changes when the aspect crosses its threshold by the band (±0.04), so dragging a
 * window edge across 0.88 or 1.3 never flaps. The pre-paint script in app/layout.tsx runs the same
 * function (shapeBootScript), so the first poster is already the right one.
 */
export type Shape = 'wide' | 'square' | 'tall' | 'phone-landscape';
export const SHAPES: readonly Shape[] = ['wide', 'square', 'tall', 'phone-landscape'];

export const TALL_BELOW = 0.88;
export const WIDE_FROM = 1.3;
export const BAND = 0.04;
export const LANDSCAPE_PHONE_H = 480;
/** Shelf columns on tall screens: 2 below this width, 3 from it. */
export const THREE_COLUMNS_FROM = 600;

/**
 * The classifier. `prev` (the shape on screen now) adds the hysteresis band; without it the plain
 * thresholds apply. Written in plain ES5 so the boot script can carry its source verbatim.
 */
export function classifyShape(w: number, h: number, prev?: string | null): Shape {
  var a = w / Math.max(1, h);
  var band = 0.04;
  var base: string;
  if (prev === 'tall') base = a < 0.88 + band ? 'tall' : a < 1.3 ? 'square' : 'wide';
  else if (prev === 'square') base = a < 0.88 - band ? 'tall' : a >= 1.3 + band ? 'wide' : 'square';
  else if (prev === 'wide' || prev === 'phone-landscape') base = a >= 1.3 - band ? 'wide' : a < 0.88 ? 'tall' : 'square';
  else base = a < 0.88 ? 'tall' : a < 1.3 ? 'square' : 'wide';
  if (base === 'wide' && h < 480) return 'phone-landscape';
  return base as Shape;
}

export const columnsFor = (w: number): 2 | 3 => (w < THREE_COLUMNS_FROM ? 2 : 3);

/** The ?shape= debug override (wide | square | tall | phone-landscape), or null. */
export function shapeOverride(): Shape | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('shape');
  return q && (SHAPES as readonly string[]).includes(q) ? (q as Shape) : null;
}

/** Width and small-viewport height in CSS px. */
export function measureViewport(): { w: number; h: number } {
  const w = Math.round(window.visualViewport ? window.visualViewport.width * (window.visualViewport.scale || 1) : window.innerWidth) || window.innerWidth;
  return { w, h: svh() };
}

let probe: HTMLDivElement | null = null;
/** 100svh in px (the toolbars-shown height); innerHeight where svh is not supported. */
function svh() {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.documentElement.appendChild(probe);
  }
  return Math.round(probe.getBoundingClientRect().height) || window.innerHeight;
}

type ShapeState = { shape: Shape; columns: 2 | 3; w: number; h: number; aspect: number; forced: boolean };

/** The current shape. Read with useShape(selector) in components, useShape.getState() elsewhere. */
export const useShape = create<ShapeState>(() => ({ shape: 'wide', columns: 3, w: 1440, h: 900, aspect: 1.6, forced: false }));

let started = false;
/**
 * Starts the classifier (once, client side): the boot script's answer first (so React's first
 * render matches the first paint), then resize and orientationchange, debounced 150ms, acting only
 * when the width or the svh height moved by more than 2%.
 */
export function startShape() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const forced = shapeOverride();
  const apply = (w: number, h: number, shape: Shape) => {
    useShape.setState({ shape, columns: columnsFor(w), w, h, aspect: +(w / h).toFixed(3), forced: !!forced });
    document.documentElement.dataset.shape = shape;
    document.documentElement.dataset.columns = String(columnsFor(w));
  };
  const first = measureViewport();
  const booted = document.documentElement.dataset.shape as Shape | undefined;
  apply(first.w, first.h, forced ?? (booted && (SHAPES as readonly string[]).includes(booted) ? booted : classifyShape(first.w, first.h)));
  let last = first;
  let timer = 0;
  const check = () => {
    const now = measureViewport();
    const moved = Math.abs(now.w - last.w) / last.w > 0.02 || Math.abs(now.h - last.h) / last.h > 0.02;
    if (!moved) return;
    last = now;
    apply(now.w, now.h, forced ?? classifyShape(now.w, now.h, useShape.getState().shape));
  };
  const later = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(check, 150);
  };
  window.__boothShape = () => useShape.getState();
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);
  window.visualViewport?.addEventListener('resize', later);
}

/**
 * The same classification before first paint (app/layout.tsx): sets <html data-shape> and
 * data-columns from innerWidth and the svh height, honouring ?shape=. Built from classifyShape's own
 * source, so the boot answer and the runtime answer can never disagree.
 */
export function shapeBootScript() {
  return `(function(){try{var d=document.documentElement;var p=document.createElement('div');p.style.cssText='position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden';d.appendChild(p);var h=Math.round(p.getBoundingClientRect().height)||innerHeight;d.removeChild(p);var w=innerWidth;var c=${classifyShape.toString()};var q=new URLSearchParams(location.search).get('shape');var s=/^(wide|square|tall|phone-landscape)$/.test(q||'')?q:c(w,h);d.setAttribute('data-shape',s);d.setAttribute('data-columns',w<${THREE_COLUMNS_FROM}?'2':'3');}catch(e){}})();`;
}

declare global {
  interface Window {
    /** L1 (09B): the classified shape now (tools/check-shape.mjs). */
    __boothShape?: () => ShapeState;
  }
}
