'use client';

import { activeLayout, setActiveLayout, type LayoutKey } from './staging';

/**
 * L2 (09B): every change of arrangement goes through here. Before the canvas exists the layout is
 * simply set (the poster covers the stage). Once it draws, the canvas's LayoutGate takes over: the
 * last frame stays on screen until the new arrangement has rendered one full frame, then a 250ms
 * crossfade.
 */
type Gate = (key: LayoutKey, why: 'shape' | 'route') => void;
let gate: Gate | null = null;
export function registerLayoutGate(g: Gate) {
  gate = g;
  return () => {
    if (gate === g) gate = null;
  };
}
export function requestLayout(key: LayoutKey, why: 'shape' | 'route') {
  if (typeof document !== 'undefined') document.documentElement.dataset.layout = key;
  if (activeLayout().key === key) return;
  if (gate) gate(key, why);
  else setActiveLayout(key);
}
