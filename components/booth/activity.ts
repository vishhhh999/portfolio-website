'use client';

/**
 * When the booth draws. R3F runs in demand mode: nothing renders unless something asks. Anything
 * that moves (a camera move, a lamp strike, a hover lift, a turn, a model fade, the hand lamp) calls
 * `kick(ms)` to keep frames coming for that long; while the booth is off screen or the tab is hidden
 * nothing renders at all. The `Activity` component in the canvas turns the deadline into frames.
 */
type Invalidate = () => void;

let invalidate: Invalidate | null = null;
let until = 0;
let continuous = false;
export const visibility = { onScreen: true, tabVisible: true };

export function bindInvalidate(fn: Invalidate | null) {
  invalidate = fn;
}

/** Keep rendering for at least `ms` from now (one frame if 0). */
export function kick(ms = 0) {
  until = Math.max(until, performance.now() + ms);
  if (canDraw()) invalidate?.();
}

/** Render every frame while on (the hand lamp follows the pointer). */
export function setContinuous(on: boolean) {
  continuous = on;
  kick();
}

export const canDraw = () => visibility.onScreen && visibility.tabVisible;

/** Called once per rendered frame: whether another frame is needed. */
export function wantsNextFrame(now: number) {
  return canDraw() && (continuous || now < until);
}
