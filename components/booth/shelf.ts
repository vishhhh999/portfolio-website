/**
 * L3 (09B): THE SHELF. On tall screens the booth becomes a wall shelving unit in the booth's own
 * materials (N8 walls, N8.5 boards, the same lamps): two columns on phones, three on portrait
 * tablets. Each sample stands on its own board with an engraved label under it; the About
 * certificate has its own slot. Layout defined here, with geometry in shelfGeometry.ts, outside the frozen room file (booth-room.glb):
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
