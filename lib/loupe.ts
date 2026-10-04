'use client';

/**
 * The spectro loupe's link to the canvas: a pending request for one pixel, read by the post chain
 * right after it renders the next frame (the drawing buffer is only valid in that same task).
 */
type Pending = { x: number; y: number; resolve: (px: [number, number, number, number] | null) => void };
export const loupeState: { pending: Pending | null } = { pending: null };

/** Resolve with the canvas pixel under (x, y) CSS px after the next frame, or null if none is drawn soon. */
export function loupeProbe(x: number, y: number, requestFrame: () => void) {
  return new Promise<[number, number, number, number] | null>((resolve) => {
    loupeState.pending?.resolve(null);
    const timer = window.setTimeout(() => {
      if (loupeState.pending?.resolve === done) loupeState.pending = null;
      resolve(null);
    }, 250);
    const done = (px: [number, number, number, number] | null) => {
      window.clearTimeout(timer);
      resolve(px);
    };
    loupeState.pending = { x, y, resolve: done };
    requestFrame();
  });
}
