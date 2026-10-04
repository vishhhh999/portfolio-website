'use client';

/**
 * Where each booth object is on screen (viewport CSS px), written by its slot every rendered frame,
 * read by the keyboard layer (BoothFocus) that puts a real, focusable button over each object.
 */
export type FocusRect = { x: number; y: number; w: number; h: number };
export const focusRects = new Map<string, FocusRect>();
const listeners = new Set<() => void>();
export function setFocusRect(slug: string, r: FocusRect | null) {
  if (r) focusRects.set(slug, r);
  else focusRects.delete(slug);
  listeners.forEach((l) => l());
}
export function onFocusRects(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}
