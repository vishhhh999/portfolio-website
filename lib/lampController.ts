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

const OPENED_KEY = 'vm:opened:v1';
const OPENING_S = 1.2;

/**
 * J5: the opening moment, first visit of a session only: the booth comes up dark (called before its
 * first frame), then the D50 tubes strike when it is on screen (runOpening). Skipped on repeat visits,
 * under reduced motion, in house lights, and when the visitor already has another lamp. The poster
 * (the LCP) and first paint never wait for it.
 */
export function prepareOpening() {
  let seen = true;
  try {
    seen = sessionStorage.getItem(OPENED_KEY) === '1';
    sessionStorage.setItem(OPENED_KEY, '1');
  } catch {}
  const st = useBooth.getState();
  if (seen || reducedMotion() || st.houseLights || st.lamp !== 'D50') return;
  useBooth.setState({ opening: true, strikeProgress: 0 });
}
export function runOpening(sound: (name: string) => void) {
  if (!useBooth.getState().opening) return;
  stop?.();
  sound('switch:D50');
  let t0 = -1;
  stop = addTicker((now) => {
    if (t0 < 0) t0 = now;
    const p = Math.min(1, (now - t0) / OPENING_S);
    useBooth.getState().setStrikeProgress(p);
    if (p >= 1) {
      useBooth.setState({ opening: false });
      stop = null;
      return false;
    }
  });
}
