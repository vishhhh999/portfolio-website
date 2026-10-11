/**
 * The booth and what stands in it, in metres. Three.js world: Y up, origin on the booth floor at the
 * centre of the interior, +Z out of the booth towards the viewer.
 *
 * Every object is shown at one uniform display scale of its own (never stretched), chosen so the nine
 * pieces read with a similar presence: packaging larger than life, devices a little smaller, the
 * Indo Thai tug as a model. The layouts place them; the tray is where a project's object goes.
 */

export type Vec3 = [number, number, number];

/** How an object is presented: its display scale, a turn (`yaw`), a lean (`rx`) and its stand. */
export type Presentation = {
  scale: number;
  yaw?: number;
  /** Rotation about x (radians) before it is set down: a book leaning back (negative), a flat set raised to face the viewer (positive). */
  rx?: number;
  /** What it stands on, if anything beyond its plinth: a sloped wedge or a small acrylic easel. */
  stand?: 'wedge' | 'easel';
  /** Lift the model off its base (m, display units) when the GLB origin is not at its base. */
  lift?: number;
};

/** Display presentation per object (the slot on the floor or a plinth). */
export const PRESENT: Record<string, Presentation> = {
  'too-yumm': { scale: 1.15, yaw: -0.18 },
  'jsw-sports': { scale: 0.8, rx: -0.3, stand: 'easel', yaw: 0.42 },
  mitooshi: { scale: 0.86, yaw: 0.32 },
  sonde: { scale: 0.92, yaw: -0.22 },
  'house-of-hex': { scale: 1.3, yaw: -0.3 },
  'bengal-t20': { scale: 0.88, rx: 0.8, stand: 'wedge' },
  sook: { scale: 1.05, yaw: 0.12 },
  shunya: { scale: 0.95, yaw: -0.1 },
  'indo-thai': { scale: 1 / 17, yaw: -0.95 },
};

/** On the tray an object may present differently (the book lies back and opens). */
export const TRAY_PRESENT: Partial<Record<string, Partial<Presentation>>> = {
  'jsw-sports': { rx: -1.05, yaw: 0, scale: 0.86 },
};

export type Riser = { x: number; z: number; w: number; d: number; h: number };
export type Slot = { x: number; y: number; z: number };

export type Layout = {
  key: 'rows' | 'tray' | 'grid';
  /** Interior of the booth. */
  room: { w: number; h: number; d: number };
  /** Plinths, risers and shelf boards (solid blocks in the booth's lighter grey). */
  risers: Riser[];
  /** Where each object stands (top of its plinth / floor). */
  slots: Record<string, Slot>;
  /** The presentation tray, front centre: a low turntable the project object slides onto. */
  tray: { x: number; z: number; r: number; h: number };
  /** Every object's display scale times this (the portrait booth is narrower). */
  objectScale?: number;
  /** Camera: eye height above the floor and the point it looks at (both scale with the room). */
  eye: { y: number; lookY: number; fov: number };
};

const BACK_Z = -0.29;
const FRONT_Z = 0.13;

/**
 * A: two clean rows. The tall pieces stand along one continuous riser at the back; the low pieces
 * stand on the floor in front, between them. The tray waits front centre.
 */
const ROWS: Layout = {
  key: 'rows',
  room: { w: 1.8, h: 0.66, d: 1.04 },
  risers: [{ x: 0, z: BACK_Z, w: 1.8, d: 0.42, h: 0.12 }],
  slots: {
    mitooshi: { x: -0.64, y: 0.12, z: BACK_Z },
    'too-yumm': { x: -0.32, y: 0.12, z: BACK_Z + 0.02 },
    'jsw-sports': { x: 0, y: 0.12, z: BACK_Z - 0.02 },
    sonde: { x: 0.32, y: 0.12, z: BACK_Z },
    'house-of-hex': { x: 0.62, y: 0.12, z: BACK_Z + 0.02 },
    'bengal-t20': { x: -0.58, y: 0, z: FRONT_Z },
    sook: { x: -0.2, y: 0, z: FRONT_Z + 0.03 },
    shunya: { x: 0.2, y: 0, z: FRONT_Z },
    'indo-thai': { x: 0.58, y: 0, z: FRONT_Z + 0.02 },
  },
  tray: { x: 0, z: 0.37, r: 0.16, h: 0.016 },
  eye: { y: 0.62, lookY: 0.2, fov: 24 },
};

/**
 * B: one long proofing tray. Every piece on a single low tray, staggered in depth, the three hero
 * pieces (book, pouch, laptop) forward in the middle, quieter pieces set back at the flanks.
 */
const TRAY: Layout = {
  key: 'tray',
  room: { w: 2.0, h: 0.6, d: 1.0 },
  risers: [{ x: 0, z: -0.12, w: 1.92, d: 0.56, h: 0.03 }],
  slots: {
    'bengal-t20': { x: -0.82, y: 0.03, z: -0.24 },
    sook: { x: -0.62, y: 0.03, z: 0.04 },
    mitooshi: { x: -0.41, y: 0.03, z: -0.26 },
    'too-yumm': { x: -0.2, y: 0.03, z: 0.02 },
    'jsw-sports': { x: 0, y: 0.03, z: -0.27 },
    shunya: { x: 0.21, y: 0.03, z: 0.04 },
    sonde: { x: 0.41, y: 0.03, z: -0.26 },
    'house-of-hex': { x: 0.6, y: 0.03, z: 0.03 },
    'indo-thai': { x: 0.81, y: 0.03, z: -0.22 },
  },
  tray: { x: 0, z: 0.34, r: 0.15, h: 0.016 },
  eye: { y: 0.56, lookY: 0.16, fov: 24 },
};

/** Tall screens: a portrait booth, three pieces on each of three tiers (two stepped risers and the floor). */
const GRID: Layout = {
  key: 'grid',
  objectScale: 1.08,
  room: { w: 1.06, h: 1.1, d: 0.8 },
  risers: [
    { x: 0, z: -0.21, w: 1.06, d: 0.38, h: 0.36 },
    { x: 0, z: -0.27, w: 1.06, d: 0.26, h: 0.71 },
    { x: 0, z: 0.08, w: 1.0, d: 0.2, h: 0.06 },
  ],
  slots: {
    'jsw-sports': { x: -0.33, y: 0.71, z: -0.27 },
    mitooshi: { x: 0.02, y: 0.71, z: -0.25 },
    'house-of-hex': { x: 0.34, y: 0.71, z: -0.26 },
    'too-yumm': { x: -0.34, y: 0.36, z: -0.08 },
    sonde: { x: 0, y: 0.36, z: -0.1 },
    sook: { x: 0.34, y: 0.36, z: -0.07 },
    'bengal-t20': { x: -0.33, y: 0.06, z: 0.1 },
    shunya: { x: 0, y: 0.06, z: 0.09 },
    'indo-thai': { x: 0.33, y: 0.06, z: 0.1 },
  },
  tray: { x: 0, z: 0.3, r: 0.1, h: 0.016 },
  eye: { y: 0.66, lookY: 0.52, fov: 28 },
};

export const LAYOUTS = { rows: ROWS, tray: TRAY, grid: GRID } as const;
export type LayoutKey = keyof typeof LAYOUTS;

/** The wide-screen composition (the 2c pick). `?layout=` overrides it for review. */
export const WIDE_LAYOUT: LayoutKey = 'rows';

export function layoutFor(aspect: number): Layout {
  if (typeof window !== 'undefined') {
    const forced = new URLSearchParams(window.location.search).get('layout') as LayoutKey | null;
    if (forced && forced in LAYOUTS && (forced === 'grid' ? aspect < 1.1 : aspect >= 1.1)) return LAYOUTS[forced];
  }
  return aspect >= 1.1 ? LAYOUTS[WIDE_LAYOUT] : GRID;
}

/** The cabinet around the opening: a thin, light, precise frame. */
export const TRIM = { side: 0.03, top: 0.05, bottom: 0.04, depth: 0.06 } as const;
/** The outer face of the cabinet for a room, and its centre height. */
export function cabinetFace(L: Layout) {
  const w = L.room.w + 2 * TRIM.side;
  const h = L.room.h + TRIM.top + TRIM.bottom;
  return { w, h, bottom: -TRIM.bottom, front: L.room.d / 2 };
}
