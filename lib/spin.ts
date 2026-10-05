'use client';

/**
 * I: the turntable. Each booth object can be turned about its vertical axis by dragging it (or with
 * ← → when it has focus, 15° a press). Only the object turns: never the lamp, the camera or the
 * layout. A turn lasts until the route changes. State lives here, outside React, so a drag never
 * re-renders anything; ObjectSlot reads it every frame.
 */
type Spin = { yaw: number; v: number; target: number | null };
const spins = new Map<string, Spin>();
let route = 0;
let dragging: string | null = null;
const listeners = new Set<() => void>();

export const spinOf = (slug: string) => {
  let s = spins.get(slug);
  if (!s) spins.set(slug, (s = { yaw: 0, v: 0, target: null }));
  return s;
};
/** The route changed: every object faces front again. */
export function resetSpins() {
  route++;
  spins.clear();
  listeners.forEach((l) => l());
}
export const spinRoute = () => route;
/** A drag is turning an object (the camera's pointer parallax holds still meanwhile). */
export const spinDragging = () => dragging;
export const setSpinDragging = (slug: string | null) => (dragging = slug);
/** Keyboard: turn by a step, eased (no inertia). */
export function nudgeSpin(slug: string, rad: number) {
  const s = spinOf(slug);
  s.v = 0;
  s.target = (s.target ?? s.yaw) + rad;
  listeners.forEach((l) => l());
}
export function onSpin(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}
/** Pixels of pointer travel before a press becomes a drag (below: a click). */
export const DRAG_PX = 6;
/** Radians per pixel dragged. */
export const RAD_PER_PX = (Math.PI * 2) / 520;
export const KEY_STEP = (15 * Math.PI) / 180;
