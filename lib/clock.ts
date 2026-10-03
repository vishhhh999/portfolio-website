'use client';

import gsap from 'gsap';
import type Lenis from 'lenis';
import { anyVideoVisible, anyViewVisible, getScroll, setScroll, viewCount } from './views';

/**
 * One clock for the whole page. GSAP's ticker drives, in this order:
 *   1. Lenis (moves the page)
 *   2. the view system's scroll value (the same number Lenis just used)
 *   3. the canvas, via R3F's advance(), only when something needs drawing
 * So the page and every WebGL view move on the same tick: no drift, and no
 * second requestAnimationFrame loop.
 */
let getLenis: () => Lenis | null | undefined = () => null;
let render: ((time: number) => void) | null = null;
let pending = 2;
let continuous = false;
let lastScroll = -1;
let wasVisible = false;

/** Lenis is created asynchronously by ReactLenis, so the clock resolves it every tick. */
export function attachLenis(get: () => Lenis | null | undefined) {
  getLenis = get;
}

/** Called by the canvas once it exists. `fn` renders one frame at time `t` (seconds). */
export function attachRenderer(fn: ((time: number) => void) | null) {
  render = fn;
  pending = Math.max(pending, 2);
}

/** Ask for N more frames (the booth's replacement for R3F's invalidate). */
export function requestFrames(n = 1) {
  pending = Math.max(pending, n);
}

/** Lamps with video, grain or a hand lamp render every tick while visible. */
export function setContinuous(on: boolean) {
  continuous = on;
  if (on) pending = Math.max(pending, 1);
}

function tick(time: number) {
  getLenis()?.raf(time * 1000);
  const y = window.scrollY;
  setScroll(y);
  if (!render) return;
  const visible = viewCount() > 0 && anyViewVisible();
  const scrolled = y !== lastScroll;
  lastScroll = y;
  // When the last view leaves the screen, draw once more so the canvas clears.
  const needs = visible ? pending > 0 || continuous || scrolled || anyVideoVisible() : wasVisible || pending > 0;
  wasVisible = visible;
  if (!needs) return;
  pending = Math.max(0, pending - 1);
  render(time);
}

let started = false;
export function startClock() {
  if (started || typeof window === 'undefined') return;
  started = true;
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(tick);
}

export const currentScroll = () => getScroll();
