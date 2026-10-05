'use client';

import { logEvent } from './eventLog';

import type Lenis from 'lenis';
import { useBooth } from './store';
import { anyVideoVisible, anyViewVisible, getScroll, setScroll, viewCount } from './views';

/**
 * One clock for the whole page. A single requestAnimationFrame loop drives, in this order:
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
/** Idle after 2s without scroll, pointer, key or lamp change: continuous lamps fall back to on-demand. */
const IDLE_MS = 2000;
let lastActivity = 0;
let lastVideoFrame = 0;
const markActivity = () => {
  lastActivity = performance.now();
  pending = Math.max(pending, 1);
};

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

/** C6 (08): render-on-demand state, logged on change (`?perf&events`). */
let runState = '';
function setRunState(s: 'active' | 'idle' | 'paused') {
  if (s === runState) return;
  runState = s;
  logEvent(`render ${s}`);
}

function tick(time: number) {
  getLenis()?.raf(time * 1000);
  const y = window.scrollY;
  setScroll(y);
  if (!render || document.hidden) {
    setRunState('paused');
    return; // hidden tab: nothing renders
  }
  const now = performance.now();
  const visible = viewCount() > 0 && anyViewVisible();
  const scrolled = y !== lastScroll;
  lastScroll = y;
  if (scrolled) lastActivity = now;
  const idle = now - lastActivity > IDLE_MS;
  // visible video keeps playing; while idle it is drawn at 30fps
  let video = visible && anyVideoVisible();
  if (video && idle && now - lastVideoFrame < 33) video = false;
  // When the last view leaves the screen, draw once more so the canvas clears.
  const needs = visible ? pending > 0 || (continuous && !idle) || scrolled || video : wasVisible || pending > 0;
  if (needs && video) lastVideoFrame = now;
  wasVisible = visible;
  setRunState(needs ? 'active' : 'idle');
  if (!needs) return;
  pending = Math.max(0, pending - 1);
  render(time);
}

/** Per-tick callbacks that run before the render (tweens). Return false to unsubscribe. */
const tickers = new Set<(time: number) => boolean | void>();
export function addTicker(fn: (time: number) => boolean | void) {
  tickers.add(fn);
  pending = Math.max(pending, 1);
  return () => tickers.delete(fn);
}

function frame(ms: number) {
  const time = ms / 1000;
  for (const fn of tickers) if (fn(time) === false) tickers.delete(fn);
  if (tickers.size) pending = Math.max(pending, 1); // a running tween draws every frame
  if (tickers.size) pending = Math.max(pending, 1); // a running tween draws every frame
  tick(time);
  requestAnimationFrame(frame);
}

let started = false;
export function startClock() {
  if (started || typeof window === 'undefined') return;
  started = true;
  requestAnimationFrame(frame);
  lastActivity = performance.now();
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'touchmove', 'keydown'] as const) {
    window.addEventListener(ev, markActivity, { passive: true });
  }
  useBooth.subscribe((s, prev) => {
    if (s.lamp !== prev.lamp || s.activeSlug !== prev.activeSlug || s.focusSlug !== prev.focusSlug) markActivity();
  });
  // back from a hidden tab: draw straight away
  document.addEventListener('visibilitychange', () => !document.hidden && markActivity());
}

export const currentScroll = () => getScroll();
