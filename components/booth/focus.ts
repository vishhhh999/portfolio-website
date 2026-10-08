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

/** J4: the sample under the pointer (home lineup), the depth of field's focus while there is no tray object. */
export const hoverFocus = { slug: null as string | null };

/**
 * M2 (09): what the cursor label says over the booth (fine pointers only): "Open <Project>" over a
 * sample, "Drag to turn" while one is pressed, "About" over the certificate. Set by ObjectSlot and
 * Certificate; read by components/ui/CursorLabel.tsx.
 */
export const cursorTarget = { label: null as string | null, pressed: false, version: 0 };
export function setCursorTarget(label: string | null, pressed = cursorTarget.pressed) {
  if (label === cursorTarget.label && pressed === cursorTarget.pressed) return;
  cursorTarget.label = label;
  cursorTarget.pressed = pressed;
  cursorTarget.version++;
}

/**
 * L3 (09B): the shelf's engraved labels on screen (viewport CSS px), written by the shelf every
 * rendered frame, and the sample a finger is pressing; the floating lamp panel stays clear of both.
 */
export type ScreenBox = { left: number; top: number; right: number; bottom: number };
export const shelfLabelRects = new Map<string, ScreenBox>();
export const tappedRect = { r: null as ScreenBox | null };
