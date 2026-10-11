'use client';

import { Box3, Vector3, type Camera } from 'three';
import type { FrameRect } from './frames';
import { emitBoxes, type Boxes } from './boxes';
import { objects, worldBox } from './registry';

/**
 * Each rendered frame, the projected box of every object in the main view (booth layer px, clipped
 * to the view). The DOM links and the spec chip sit on these boxes, so clicking, hovering and
 * keyboard focus all work on real page elements while the canvas stays aria-hidden.
 */
const boxes: Boxes = new Map();
const wb = new Box3();
const v = new Vector3();

export function publishBoxes(camera: Camera | null, cw: number, ch: number, view: FrameRect | null) {
  boxes.clear();
  if (camera && view) {
    for (const [slug] of objects) {
      if (!worldBox(slug, wb)) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const x of [wb.min.x, wb.max.x])
        for (const y of [wb.min.y, wb.max.y])
          for (const z of [wb.min.z, wb.max.z]) {
            v.set(x, y, z).project(camera);
            const px = ((v.x + 1) / 2) * cw, py = ((1 - v.y) / 2) * ch;
            x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
          }
      // the object's top centre (front face) anchors the spec chip
      v.set((wb.min.x + wb.max.x) / 2, wb.max.y, wb.max.z).project(camera);
      const top = ((1 - v.y) / 2) * ch;
      const cx0 = Math.max(x0, view.x), cx1 = Math.min(x1, view.x + view.w);
      const cy0 = Math.max(y0, view.y), cy1 = Math.min(y1, view.y + view.h);
      if (cx1 - cx0 < 4 || cy1 - cy0 < 4) continue;
      boxes.set(slug, { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0, top });
    }
  }
  emitBoxes(boxes, view);
}
