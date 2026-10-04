'use client';

import { HOUSE_LIGHTS_KEY, useBooth } from './store';
import { houseLightsSound } from './sound';

/**
 * House lights is a MODE of the page, never a page (B). On: the current page shows its flat version
 * (no booth, no canvas, plain images); off: the booth comes back on the same page, under the lamp
 * the visitor had. The URL never changes. `<html data-house-lights>` is the single switch the CSS
 * reads; the pre-paint script in app/layout.tsx sets it from the stored preference, so a page
 * loads straight into its flat version with no flash.
 *
 *   remember: the visitor's own choice (rocker or I): kept in localStorage for later visits
 *   auto:     the booth stepped aside on its own (slow GPU): this session only
 */
export const AUTO_KEY = 'vm:autoHouseLights:v1';

export function setHouseLightsMode(on: boolean, opts: { remember?: boolean; auto?: boolean; notice?: string | null; silent?: boolean } = {}) {
  const root = document.documentElement;
  const was = root.hasAttribute('data-house-lights');
  root.toggleAttribute('data-house-lights', on);
  try {
    if (opts.remember) localStorage.setItem(HOUSE_LIGHTS_KEY, on ? '1' : '0');
    if (opts.auto && on) sessionStorage.setItem(AUTO_KEY, '1');
    // turning the booth back on by hand: never switch away on our own again this session
    if (!on && opts.remember && sessionStorage.getItem(AUTO_KEY) === '1') sessionStorage.setItem(AUTO_KEY, 'declined');
  } catch {}
  useBooth.setState({ houseLights: on, notice: opts.notice ?? (on ? useBooth.getState().notice : null) });
  if (was !== on && !opts.silent) houseLightsSound(on);
}

/** The state the pre-paint script decided (read once on hydration). */
export const houseLightsOnLoad = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-house-lights');
