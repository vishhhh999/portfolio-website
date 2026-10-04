'use client';

import { addTicker } from './clock';
import { lampById } from './lampPresets';
import { LAMP_KEY, useBooth } from './store';
import type { Lamp } from './types';

let stop: (() => void) | null = null;

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

/**
 * Flip a lamp switch. The rig reads `strikeProgress` every frame and shapes
 * each lamp's output with its own strike curve (flicker, ramp, buzz, instant).
 * Reduced motion: instant swap, no flicker.
 */
export function switchLamp(id: Lamp) {
  const { lamp, setLamp, setStrikeProgress } = useBooth.getState();
  if (id === lamp) return;
  stop?.();
  stop = null;
  setLamp(id);
  const { duration } = lampById(id).strike;
  if (reducedMotion() || duration <= 0.05) {
    setStrikeProgress(1);
    return;
  }
  setStrikeProgress(0);
  let t0 = -1;
  stop = addTicker((now) => {
    if (t0 < 0) t0 = now;
    const p = Math.min(1, (now - t0) / duration);
    setStrikeProgress(p);
    if (p >= 1) {
      stop = null;
      return false;
    }
  });
}
