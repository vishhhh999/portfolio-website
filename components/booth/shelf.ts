/**
 * L3 (09B): THE SHELF. On tall screens the booth becomes a wall shelving unit in the booth's own
 * materials (N8 walls, N8.5 boards, the same lamps): two columns on phones, three on portrait
 * tablets. Each sample stands on its own board with an engraved label under it; the About
 * certificate has its own slot. Built here in code, outside the frozen room file (booth-room.glb):
 * its own geometry, its own uv1 atlas and AO bake (tools/bake-shelf.mjs), its own lock once approved.
 *
 * World: the same as the booth (metres, Y up, +Z toward the camera). The unit stands on y = 0,
 * centred on x = 0, its front edges on z = SHELF.frontZ.
 *
 * Every object keeps its true size (K = 1, the tug 1:24 on its plate): the bays are only as wide as
 * the pieces need, so the smallest (the House of Hex phone, 17.6cm tall) stays ≥ 14% of the frame's
 * width (tools/check-sizes.mjs). On three columns the two widest pieces (SHUNYA, the JSW book) take a
 * double bay, so the single bays can stay narrow.
 * Nothing here touches the DOM, and it only uses staging.ts inside functions (an import cycle).
 */
import { BufferAttribute, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Staging } from './staging.ts';

export const SHELF = {
  /** boards and side panels */
  board: 0.022,
  /** the back panel */
  back: 0.012,
  /** clear depth of a bay, front edge to back panel */
  depth: 0.34,
  /** the recessed plinth under the bottom board */
  kick: 0.07,
  /** the top board */
  crown: 0.026,
  frontZ: 0.2,
  /** samples stand this far behind the front edge */
  inset: 0.025,
  /** chamfer on every edge */
  chamfer: 0.002,
} as const;

export type ShelfSlot = { slug: string; col: number; span: 1 | 2 };
/** A row of bays (top to bottom); `clear` is the opening height above its board. */
export type ShelfRow = { clear: number; slots: ShelfSlot[] };
export type ShelfDef = {
  cols: 2 | 3 | 4;
  bay: number;
  rows: ShelfRow[];
  width: number;
  height: number;
  frontZ: number;
  backZ: number;
  /** each row's floor (the top face of its board), top row first */
  floors: number[];
  /** the label rail height under each board (sized so a label reads at ~9px or more on screen) */
  label: { h: number; text: number };
  /** slug → its slot, for labels, keyboard order and picking */
  order: string[];
  slotX: (s: ShelfSlot) => number;
  slotW: (s: ShelfSlot) => number;
};

/**
 * Two columns (phones): bays 46cm (SHUNYA is 42cm wide), five rows. The camera stands level with the
 * middle of the screen, so the top rows are seen from a little below: the upright pieces (the pouch,
 * the phone, the book, the tablet) stand there; the flat ones (the laptop, SHUNYA, the wedge, the
 * tug) sit lower, where they are seen from level or above.
 */
const ROWS2: ShelfRow[] = [
  { clear: 0.31, slots: [{ slug: 'too-yumm', col: 0, span: 1 }, { slug: 'house-of-hex', col: 1, span: 1 }] },
  { clear: 0.34, slots: [{ slug: 'jsw-sports', col: 0, span: 1 }, { slug: 'sonde', col: 1, span: 1 }] },
  { clear: 0.3, slots: [{ slug: 'mitooshi', col: 0, span: 1 }, { slug: 'bengal-t20', col: 1, span: 1 }] },
  { clear: 0.23, slots: [{ slug: 'shunya', col: 0, span: 1 }, { slug: 'indo-thai', col: 1, span: 1 }] },
  { clear: 0.26, slots: [{ slug: 'sook', col: 0, span: 1 }, { slug: 'about', col: 1, span: 1 }] },
];
/** Three columns (portrait tablets): bays 34cm, four rows, the JSW book and SHUNYA in double bays. */
const ROWS3: ShelfRow[] = [
  { clear: 0.31, slots: [{ slug: 'too-yumm', col: 0, span: 1 }, { slug: 'house-of-hex', col: 1, span: 1 }, { slug: 'sonde', col: 2, span: 1 }] },
  { clear: 0.34, slots: [{ slug: 'jsw-sports', col: 0, span: 2 }, { slug: 'sook', col: 2, span: 1 }] },
  { clear: 0.29, slots: [{ slug: 'mitooshi', col: 0, span: 1 }, { slug: 'shunya', col: 1, span: 2 }] },
  { clear: 0.26, slots: [{ slug: 'bengal-t20', col: 0, span: 1 }, { slug: 'indo-thai', col: 1, span: 1 }, { slug: 'about', col: 2, span: 1 }] },
];

/**
 * Four columns, three tiers (SQUARE shapes, 0.88 to 1.3): the whole unit fits the first screen, every
 * sample whole and ≥ 12% of the frame. The room is frozen, so the square shape's "taller cabinet" is
 * this low, wide unit in the booth's materials (never a crop of the cabinet).
 */
const ROWS4: ShelfRow[] = [
  { clear: 0.31, slots: [{ slug: 'too-yumm', col: 0, span: 1 }, { slug: 'house-of-hex', col: 1, span: 1 }, { slug: 'sonde', col: 2, span: 1 }, { slug: 'sook', col: 3, span: 1 }] },
  { clear: 0.34, slots: [{ slug: 'jsw-sports', col: 0, span: 2 }, { slug: 'mitooshi', col: 2, span: 1 }, { slug: 'bengal-t20', col: 3, span: 1 }] },
  { clear: 0.27, slots: [{ slug: 'shunya', col: 0, span: 2 }, { slug: 'indo-thai', col: 2, span: 1 }, { slug: 'about', col: 3, span: 1 }] },
];

const shelfCache = new Map<number, ShelfDef>();
export function shelfDef(cols: 2 | 3 | 4): ShelfDef {
  const hit = shelfCache.get(cols);
  if (hit) return hit;
  const rows = cols === 2 ? ROWS2 : cols === 3 ? ROWS3 : ROWS4;
  const bay = cols === 2 ? 0.46 : cols === 3 ? 0.34 : 0.33;
  const { board: T, kick, crown } = SHELF;
  const width = cols * bay + (cols + 1) * T;
  // rows stack up from the bottom board (on the kick); floors[] is listed top row first
  const floors: number[] = [];
  let y = kick + T;
  for (let i = rows.length - 1; i >= 0; i--) {
    floors[i] = y;
    y += rows[i].clear + T;
  }
  const height = y - T + crown; // the top row's opening ends under the crown, not under another board
  const left = -width / 2;
  const slotX = (s: ShelfSlot) => left + T + s.col * (bay + T) + (s.span * bay + (s.span - 1) * T) / 2;
  const slotW = (s: ShelfSlot) => s.span * bay + (s.span - 1) * T;
  const order = rows.flatMap((r) => r.slots.map((s) => s.slug));
  const def: ShelfDef = {
    cols,
    bay,
    rows,
    width,
    height,
    frontZ: SHELF.frontZ,
    backZ: SHELF.frontZ - SHELF.depth - SHELF.back,
    floors,
    label: cols === 2 ? { h: 0.05, text: 0.03 } : { h: 0.036, text: 0.021 },
    order,
    slotX,
    slotW,
  };
  shelfCache.set(cols, def);
  return def;
}

/** The tug's plinth on the shelf: low, so its 1:24 plate stays on it. */
const TUG_PLINTH = { h: 0.045, w: 0.31, d: 0.25 };

/**
 * The arrangement on the shelf: every sample at its true size (the desktop object sizes), standing
 * on its board `SHELF.inset` behind the front edge, centred in its bay.
 */
export function shelfLayout(desktop: Record<string, Staging>, cols: 2 | 3 | 4) {
  const def = shelfDef(cols);
  const staging: Record<string, Staging> = {};
  let ledge = { x: 0, y: 0, w: 0.3, d: 0.06, h: 0.012 };
  let certificate = { x: 0, z: 0 };
  def.rows.forEach((row, ri) => {
    for (const s of row.slots) {
      const x = def.slotX(s);
      const floor = def.floors[ri];
      if (s.slug === 'about') {
        // the certificate leans on the back panel, standing on its board (Certificate.tsx reads the ledge's top)
        ledge = { x, y: floor - 0.012, w: Math.min(0.3, def.slotW(s) - 0.04), d: 0.06, h: 0.012 };
        certificate = { x, z: def.backZ + SHELF.back + 0.035 };
        continue;
      }
      const d = desktop[s.slug];
      if (!d) continue;
      const tug = !!d.plate;
      const base = tug ? { kind: 'plinth' as const, ...TUG_PLINTH } : { kind: 'none' as const, w: d.object.w * 1.04, d: d.object.d * 1.04, h: 0 };
      // Bring the tablet laptop's hinge forward of the divider's sightline. Its rear feet
      // remain on the board; the keyboard projects slightly beyond the label rail.
      const laptopForward = cols === 3 && s.slug === 'mitooshi' ? 0.055 : 0;
      const z = SHELF.frontZ - SHELF.inset - Math.max(d.object.d, base.d) / 2 + laptopForward;
      staging[s.slug] = { object: d.object, base, x, y: floor, z, scale: d.scale, plate: d.plate, trayBox: d.trayBox };
    }
  });
  return { staging, ledge, certificate, def };
}

// ── geometry ────────────────────────────────────────────────────────────────────────────────

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
