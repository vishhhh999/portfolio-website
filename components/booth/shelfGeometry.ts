/** Shelf geometry and its AO atlas, loaded with the 3D renderer. */
import { BufferAttribute, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Staging } from './staging.ts';
import { SHELF, shelfDef } from './shelf.ts';

export type ShelfPart = {
  name: string;
  geometry: BufferGeometry;
  position: [number, number, number];
  role: 'carcass' | 'back' | 'board' | 'label' | 'base';
  slug?: string;
};

export const SHELF_ATLAS = { size: 1024, pxPerMetre: 220, pad: 4 } as const;

const rbox = (w: number, h: number, d: number) => new RoundedBoxGeometry(w, h, d, 1, SHELF.chamfer);

/** Every static part of the unit, with a non-overlapping uv1 atlas (for the AO bake). */
export function shelfParts(cols: 2 | 3 | 4, staging: Record<string, Staging>): ShelfPart[] {
  const def = shelfDef(cols);
  const { board: T, back: B, depth, kick, crown, frontZ } = SHELF;
  const parts: ShelfPart[] = [];
  const W = def.width, H = def.height;
  const cz = frontZ - (depth + B) / 2; // the carcass's centre in depth
  const fullD = depth + B;
  // the sides run floor to top, full depth
  for (const s of [-1, 1])
    parts.push({ name: s < 0 ? 'side-left' : 'side-right', role: 'carcass', geometry: rbox(T, H, fullD), position: [s * (W / 2 - T / 2), H / 2, cz] });
  // the top board, between the sides
  parts.push({ name: 'crown', role: 'carcass', geometry: rbox(W - 2 * T + 0.002, crown, fullD), position: [0, H - crown / 2, cz] });
  // the plinth: recessed 3cm under the bottom board
  parts.push({ name: 'kick', role: 'carcass', geometry: rbox(W - 2 * T + 0.002, kick, 0.03), position: [0, kick / 2, frontZ - 0.03 - 0.015] });
  // the back panel, between the sides, behind the bays
  parts.push({ name: 'back', role: 'back', geometry: rbox(W - 2 * T + 0.002, H - crown - kick + 0.002, B), position: [0, kick + (H - crown - kick) / 2, frontZ - depth - B / 2] });
  // the boards: one under every row (the bottom one on the kick)
  def.rows.forEach((row, ri) => {
    const top = def.floors[ri];
    parts.push({ name: `board-${ri}`, role: 'board', geometry: rbox(W - 2 * T + 0.002, T, depth), position: [0, top - T / 2, frontZ - depth / 2] });
    // dividers between the bays of this row (none inside a double bay)
    for (let c = 1; c < cols; c++) {
      const spanned = row.slots.some((s) => s.span === 2 && s.col < c && s.col + s.span > c);
      if (spanned) continue;
      const x = -W / 2 + T + c * (def.bay + T) - T / 2;
      parts.push({ name: `divider-${ri}-${c}`, role: 'carcass', geometry: rbox(T, row.clear + 0.002, depth), position: [x, top + row.clear / 2, frontZ - depth / 2] });
    }
  });
  // the engraved label rails: one per slot, on the front edge of its board, hanging under it
  def.rows.forEach((row, ri) => {
    for (const s of row.slots) {
      const lw = Math.min(def.slotW(s) - 0.03, cols === 2 ? 0.3 : 0.24);
      parts.push({ name: `label-${s.slug}`, role: 'label', slug: s.slug, geometry: rbox(lw, def.label.h, 0.004), position: [def.slotX(s), def.floors[ri] - 0.002 - def.label.h / 2, frontZ + 0.0025] });
    }
  });
  // the tug's plinth (the only base on the shelf)
  for (const [slug, st] of Object.entries(staging))
    if (st.base.kind === 'plinth') parts.push({ name: `base-${slug}`, role: 'base', slug, geometry: new RoundedBoxGeometry(st.base.w, st.base.h, st.base.d, 3, 0.003), position: [st.x, (st.y ?? 0) + st.base.h / 2, st.z] });
  addShelfAtlas(parts);
  return parts;
}

/** uv1: a rectangle per box face, sized by its area (shelf packing, tallest first). */
function addShelfAtlas(parts: ShelfPart[]) {
  type Rect = { part: ShelfPart; group: number; w: number; h: number; x: number; y: number; ext: [number, number] };
  const rects: Rect[] = [];
  for (const part of parts) {
    const g = part.geometry;
    const pos = g.getAttribute('position');
    g.groups.forEach((grp, gi) => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        const vi = g.index ? g.index.getX(i) : i;
        const p = [pos.getX(vi), pos.getY(vi), pos.getZ(vi)];
        for (let k = 0; k < 3; k++) (min[k] = Math.min(min[k], p[k])), (max[k] = Math.max(max[k], p[k]));
      }
      const [ua, va] = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]][gi] as [number, number];
      // labels carry their own texture: a token patch in the atlas
      const density = part.role === 'label' ? 20 : SHELF_ATLAS.pxPerMetre;
      const ext: [number, number] = [max[ua] - min[ua], max[va] - min[va]];
      rects.push({ part, group: gi, w: 0, h: 0, x: 0, y: 0, ext });
      const r = rects[rects.length - 1];
      r.w = Math.max(4, Math.ceil(ext[0] * density));
      r.h = Math.max(4, Math.ceil(ext[1] * density));
    });
  }
  const N = SHELF_ATLAS.size, pad = SHELF_ATLAS.pad;
  let used = Infinity;
  for (let scale = 1; scale > 0.2 && used > N; scale -= 0.05) {
    for (const r of rects) {
      const density = (r.part.role === 'label' ? 20 : SHELF_ATLAS.pxPerMetre) * scale;
      r.w = Math.max(4, Math.ceil(r.ext[0] * density));
      r.h = Math.max(4, Math.ceil(r.ext[1] * density));
    }
    rects.sort((a, b) => b.h - a.h);
    let x = pad, y = pad, rowH = 0;
    for (const r of rects) {
      if (x + r.w + pad > N) (x = pad), (y += rowH + pad), (rowH = 0);
      r.x = x;
      r.y = y;
      x += r.w + pad;
      rowH = Math.max(rowH, r.h);
    }
    used = y + rowH + pad;
  }
  if (used > N) throw new Error(`shelf atlas overflow: ${used}px`);
  for (const part of parts) {
    const g = part.geometry;
    const uv = g.getAttribute('uv');
    const uv1 = new Float32Array(uv.count * 2);
    g.groups.forEach((grp, gi) => {
      const r = rects.find((q) => q.part === part && q.group === gi)!;
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        const vi = g.index ? g.index.getX(i) : i;
        uv1[vi * 2] = (r.x + uv.getX(vi) * r.w) / N;
        uv1[vi * 2 + 1] = 1 - (r.y + (1 - uv.getY(vi)) * r.h) / N;
      }
    });
    g.setAttribute('uv1', new BufferAttribute(uv1, 2));
  }
}
