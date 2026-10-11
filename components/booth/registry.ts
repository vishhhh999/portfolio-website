'use client';

import { Box3, Vector3, type Object3D } from 'three';

/**
 * What the canvas knows about each object right now, shared with the DOM overlay (the links and
 * the spec chip are placed over the objects' projected boxes) and the lamp rig (screen spill).
 */
export type Entry = {
  slug: string;
  /** The object's moving group (slot, lift, turn). */
  root: Object3D;
  /** Display size of the object (m), measured after scale and lean. */
  size: Vector3;
  /** Layer used by the phone strip thumbnails (1 + lineup index). */
  layer: number;
};
export const objects = new Map<string, Entry>();

/** Device screens: a point on the display and the way it faces (world), for the SCREEN lamp's spill. */
export const screenAnchors = new Map<string, { at: Object3D; colour: { r: number; g: number; b: number } }>();

export function worldBox(slug: string, out = new Box3()) {
  const e = objects.get(slug);
  if (!e) return null;
  e.root.updateWorldMatrix(true, false);
  const p = new Vector3().setFromMatrixPosition(e.root.matrixWorld);
  out.min.set(p.x - e.size.x / 2, p.y, p.z - e.size.z / 2);
  out.max.set(p.x + e.size.x / 2, p.y + e.size.y, p.z + e.size.z / 2);
  return out;
}
