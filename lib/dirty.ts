'use client';

import { logEvent } from './eventLog';

/**
 * B1 (08): render-on-change for the booth's expensive side renders. Each system re-renders only
 * while it is dirty, and otherwise reuses its last result:
 *   reflector  the floor reflection (a full scene render + blur)
 *   shadow     the key light's shadow map (VSM: depth + blur)
 *   normals    the SSAO normal/depth pass
 * Marked dirty by whatever changes what they show: the camera, the lamp (and its strike), an
 * object's transform (tray move, turntable, JSW opening, hover lift), the view rect, the DPR, or a
 * model finishing loading. `?perf` shows the flags; `?perf&events` logs every re-render.
 */
export type DirtySystem = 'reflector' | 'shadow' | 'normals';
const ALL: DirtySystem[] = ['reflector', 'shadow', 'normals'];
const left: Record<DirtySystem, number> = { reflector: 3, shadow: 3, normals: 3 };
/** What re-rendered on the last frame (for the ?perf overlay). */
export const dirtyLast: Record<DirtySystem, boolean> = { reflector: false, shadow: false, normals: false };
/** Re-renders since load, per system. */
export const dirtyCount: Record<DirtySystem, number> = { reflector: 0, shadow: 0, normals: 0 };
let lastReason = '';

/** Mark systems dirty for the next `frames` rendered frames (2 covers a blur settling). */
export function markDirty(reason: string, systems: DirtySystem[] = ALL, frames = 2) {
  for (const s of systems) left[s] = Math.max(left[s], frames);
  if (reason !== lastReason) {
    lastReason = reason;
    logEvent(`dirty: ${reason} → ${systems.join(', ')}`);
  }
}

/** Called once per frame by each system: true = render this frame. */
export function takeDirty(s: DirtySystem): boolean {
  const on = left[s] > 0;
  if (on) {
    left[s]--;
    dirtyCount[s]++;
  }
  dirtyLast[s] = on;
  return on;
}
