/**
 * Booth staging: the physical booth and the samples inside it, in metres.
 * Three.js world: Y-up, origin on the booth floor at the centre of the opening
 * line of the back row, +Z towards the camera (out of the booth).
 * Exported to tools/camera.json for the Blender scene.
 */

export type Size3 = { w: number; h: number; d: number };

/**
 * One sample: the object (real-world scale), the riser it is propped on and
 * where that riser stands. Two rows, like a proofing lineup: wide, tall
 * samples at the back; small ones forward so they hold their size in frame.
 */
export type Staging = { object: Size3; plinth: Size3; x: number; z: number };

const BACK_Z = -0.4;
const FRONT_Z = 0.76;

export const STAGING: Record<string, Staging> = {
  // back row, left → right: the three large samples, raised so they read over the front row
  'jsw-sports': { object: { w: 0.37, h: 0.17, d: 0.2 }, plinth: { w: 0.42, d: 0.28, h: 0.13 }, x: -0.47, z: BACK_Z },
  mitooshi: { object: { w: 0.3, h: 0.21, d: 0.24 }, plinth: { w: 0.36, d: 0.3, h: 0.15 }, x: 0.0, z: BACK_Z },
  sonde: { object: { w: 0.25, h: 0.19, d: 0.15 }, plinth: { w: 0.31, d: 0.24, h: 0.17 }, x: 0.45, z: BACK_Z },
  // front row: packaging on the flanks, the small brand + product pieces centre, in front of the back-row gaps
  'too-yumm': { object: { w: 0.16, h: 0.24, d: 0.07 }, plinth: { w: 0.21, d: 0.15, h: 0.02 }, x: -0.52, z: FRONT_Z },
  'house-of-hex': { object: { w: 0.13, h: 0.17, d: 0.09 }, plinth: { w: 0.18, d: 0.14, h: 0.06 }, x: -0.18, z: FRONT_Z },
  'bengal-t20': { object: { w: 0.22, h: 0.07, d: 0.15 }, plinth: { w: 0.27, d: 0.19, h: 0.05 }, x: 0.17, z: FRONT_Z },
  sook: { object: { w: 0.24, h: 0.13, d: 0.07 }, plinth: { w: 0.29, d: 0.16, h: 0.03 }, x: 0.52, z: FRONT_Z },
  // archive-only: never staged in the lineup; sizes kept for the tray and archive viewer
  shunya: { object: { w: 0.2, h: 0.09, d: 0.1 }, plinth: { w: 0.26, d: 0.2, h: 0.06 }, x: 0, z: 0 },
  'indo-thai': { object: { w: 0.3, h: 0.21, d: 0.24 }, plinth: { w: 0.38, d: 0.32, h: 0.1 }, x: 0, z: 0 },
};

/** Plinths: matte, a step lighter than the floor. */
export const PLINTH_GREY = '#B4B4B2';
/** Small chamfer on every plinth edge. */
export const PLINTH_CHAMFER = 0.004;

/**
 * The booth: an open-fronted box. Interior width × height × depth, back wall
 * at backZ, the opening (with its front lip) at frontZ. The cabinet shell
 * around it only shows on narrow or portrait screens.
 */
export const BOOTH = { width: 1.5, height: 0.84, backZ: -0.75, frontZ: 1.0, wall: 0.04 } as const;
/** Front lip at the opening: a thin raised sill carrying the maker's plate. */
export const LIP = { h: 0.03, d: 0.045 } as const;
/**
 * The cabinet seen from outside: a dark housing framing the opening. Side posts,
 * a taller header (the lamp housing), a sill under the opening and a shallow base.
 */
export const CABINET = { post: 0.04, header: 0.06, sill: 0.045, base: 0.015, proud: 0.02 } as const;
/** Outer front-face size of the cabinet, and its vertical centre (world y). */
export const CABINET_FACE = {
  w: BOOTH.width + 2 * CABINET.post,
  h: BOOTH.height + CABINET.header + CABINET.sill + CABINET.base,
  bottom: -CABINET.sill - CABINET.base,
} as const;
/** Ceiling diffuser (the lamp's light-emitting face). */
export const DIFFUSER = { w: 1.28, d: 1.25, z: -0.05 } as const;

/**
 * Proofing tray at the front centre, raised on a short pedestal so the sample
 * clears the lip: where the active sample is examined. Hidden until in use.
 * `top` is the height of the plate's upper face.
 */
export const TRAY = { z: 0.8, w: 0.46, d: 0.24, h: 0.008, stand: 0.11, top: 0.118 } as const;
/** How far the lineup steps back while something is on the tray. */
export const RECEDE_DZ = -0.18;

/** Lens: ~100mm full-frame equivalent → 2·atan(12/100) ≈ 13.7° vertical FOV. */
export const FOV = 13.7;
export const SENSOR_HEIGHT_MM = 24;
export const FOCAL_MM = SENSOR_HEIGHT_MM / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** Lineup shot rules: lip top sits this far down (v, -1 = bottom), ceiling edge this far up. */
export const SHOT = { lipV: -0.93, ceilingV: 0.8, minWallFrame: 1.12 } as const;

/** Calibration props: a small ledge on the back wall, right of centre. */
export const PROPS = {
  ledge: { x: 0.47, y: 0.4, w: 0.4, d: 0.05, h: 0.012 },
  /** Mini 24-patch chart: half the classic size. */
  checker: { x: 0.56, w: 0.14, h: 0.108, lean: 0.22, yaw: -0.16 },
  card: { x: 0.4, w: 0.1, h: 0.067, lean: 0.26, yaw: 0.1 },
  /** Glossy laminated swatch: catches the lamp's reflection (TL84 tubes show as streaks). */
  gloss: { x: 0.31, w: 0.07, h: 0.1, lean: 0.42, yaw: 0.18 },
} as const;

/** Plinth positions for a set of lineup slugs (explicit staging, not computed). */
export function lineupLayout(slugs: string[]) {
  const x: Record<string, number> = {};
  const z: Record<string, number> = {};
  for (const s of slugs) {
    x[s] = STAGING[s].x;
    z[s] = STAGING[s].z;
  }
  return { x, z };
}

declare global {
  interface Window {
    /** Current booth stage rect in CSS px (set by the view system); used to map pointers into the booth. */
    __boothStageRect?: () => DOMRect;
  }
}
