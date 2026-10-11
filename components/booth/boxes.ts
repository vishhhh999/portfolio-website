'use client';

import type { FrameRect } from './frames';

/**
 * The projected box of each object in the main view (booth layer px), published by the canvas each
 * frame and read by the DOM links and spec chip. No three.js here, so the page's first bundle stays
 * free of it.
 */
export type Boxes = Map<string, { x: number; y: number; w: number; h: number; top: number }>;
const listeners = new Set<(b: Boxes, view: FrameRect | null) => void>();

export function emitBoxes(b: Boxes, view: FrameRect | null) {
  listeners.forEach((fn) => fn(b, view));
}

export function onBoxes(fn: (b: Boxes, view: FrameRect | null) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
