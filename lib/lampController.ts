'use client';

import gsap from 'gsap';
import { lampById } from './lampPresets';
import { useBooth } from './store';
import type { Lamp } from './types';

let tween: gsap.core.Tween | null = null;
const proxy = { p: 1 };

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Flip a lamp switch. The rig reads `strikeProgress` every frame and shapes
 * each lamp's output with its own strike curve (flicker, ramp, buzz, instant).
 * Reduced motion: instant swap, no flicker.
 */
export function switchLamp(id: Lamp) {
  const { lamp, setLamp, setStrikeProgress } = useBooth.getState();
  if (id === lamp) return;
  tween?.kill();
  setLamp(id);
  const { duration } = lampById(id).strike;
  if (reducedMotion() || duration <= 0.05) {
    proxy.p = 1;
    setStrikeProgress(1);
    return;
  }
  proxy.p = 0;
  setStrikeProgress(0);
  tween = gsap.to(proxy, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate: () => setStrikeProgress(proxy.p),
  });
}
