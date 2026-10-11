'use client';

import { lampById } from './lampPresets';
import { LAMP_KEY, useBooth } from './store';
import type { Lamp } from './types';

let raf = 0;

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The only ways a lamp changes: the visitor flips a switch, presses 1 to 7, or uses a project's
 * "view under its native lamp" chip. The pick is remembered for the session; routes never set it.
 */
export function pickLamp(id: Lamp) {
  try {
    sessionStorage.setItem(LAMP_KEY, id);
  } catch {}
  useBooth.getState().setLampPicked();
  switchLamp(id);
}

/** Flip a lamp: the rig shapes each lamp's output with its own strike curve. Reduced motion: instant. */
export function switchLamp(id: Lamp) {
  const { lamp, setLamp, setStrikeProgress } = useBooth.getState();
  if (id === lamp) return;
  cancelAnimationFrame(raf);
  setLamp(id);
  const { duration } = lampById(id).strike;
  if (reducedMotion()) {
    setStrikeProgress(1);
    return;
  }
  setStrikeProgress(0);
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / 1000 / duration);
    setStrikeProgress(p);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
