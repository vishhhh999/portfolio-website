/**
 * Booth staging: the physical layout of the lineup, in metres.
 * Three.js world: Y-up, origin on the floor at the centre of the lineup row,
 * +Z towards the camera. Exported to tools/camera.json for the Blender scene.
 */

export type Size3 = { w: number; h: number; d: number };

/** Sample footprint (object on its own, real-world scale) and the riser it is propped on. */
export type Staging = { object: Size3; plinth: Size3 };

/**
 * Plinth heights balance visual weight across the row the way samples are
 * propped in a proofing lineup: the smallest object (phone) rides highest,
 * the largest (book, pouch) sit lowest.
 */
export const STAGING: Record<string, Staging> = {
  'too-yumm': { object: { w: 0.16, h: 0.24, d: 0.07 }, plinth: { w: 0.26, d: 0.2, h: 0.03 } },
  'jsw-sports': { object: { w: 0.4, h: 0.3, d: 0.17 }, plinth: { w: 0.46, d: 0.28, h: 0.03 } },
  mitooshi: { object: { w: 0.3, h: 0.21, d: 0.24 }, plinth: { w: 0.38, d: 0.32, h: 0.1 } },
  sonde: { object: { w: 0.25, h: 0.19, d: 0.14 }, plinth: { w: 0.32, d: 0.24, h: 0.13 } },
  'house-of-hex': { object: { w: 0.08, h: 0.15, d: 0.07 }, plinth: { w: 0.24, d: 0.2, h: 0.24 } },
  'bengal-t20': { object: { w: 0.22, h: 0.06, d: 0.15 }, plinth: { w: 0.3, d: 0.24, h: 0.17 } },
  sook: { object: { w: 0.24, h: 0.13, d: 0.07 }, plinth: { w: 0.3, d: 0.18, h: 0.08 } },
  // archive-only (not staged in the booth, kept so their placeholders still work in the tray)
  shunya: { object: { w: 0.2, h: 0.09, d: 0.1 }, plinth: { w: 0.26, d: 0.2, h: 0.06 } },
  'indo-thai': { object: { w: 0.3, h: 0.21, d: 0.24 }, plinth: { w: 0.38, d: 0.32, h: 0.1 } },
};

export const PLINTH_GAP = 0.05;
/** Plinths: matte, a step lighter than the N7 floor. */
export const PLINTH_GREY = '#B3B3B1';
/** Small chamfer on every plinth edge. */
export const PLINTH_CHAMFER = 0.004;

/** Booth interior. Depth runs past the camera so the floor never ends in frame. */
export const BOOTH = { width: 4.2, depth: 16, height: 2.4, backZ: -0.7 } as const;
/** Proofing tray at the front of the booth: where the active object is examined. */
export const TRAY = { z: 0.6, w: 0.9, d: 0.5 } as const;
/** Where the rest of the lineup steps back to while something is on the tray. */
export const RECEDE_Z = -0.32;

/** Lens: ~100mm full-frame equivalent → 2·atan(12/100) ≈ 13.7° vertical FOV. */
export const FOV = 13.7;
export const SENSOR_HEIGHT_MM = 24;
export const FOCAL_MM = SENSOR_HEIGHT_MM / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** Lineup shot: frame width = lineup width × margin; floor line pinned this far down the frame. */
export const LINEUP_MARGIN = 1.06;
export const FLOOR_LINE = 0.76;

export function lineupLayout(slugs: string[]) {
  const widths = slugs.map((s) => STAGING[s].plinth.w);
  const width = widths.reduce((a, b) => a + b, 0) + PLINTH_GAP * (slugs.length - 1);
  const x: Record<string, number> = {};
  let cursor = -width / 2;
  slugs.forEach((s, i) => {
    x[s] = cursor + widths[i] / 2;
    cursor += widths[i] + PLINTH_GAP;
  });
  return { width, x };
}

/** Calibration props, leaning on the back wall behind the right of the row. */
export const PROPS = {
  shelf: { x: 1.02, w: 0.62, d: 0.12, h: 0.25 },
  checker: { x: 1.12, w: 0.279, h: 0.216, lean: 0.2 },
  card: { x: 0.82, w: 0.15, h: 0.1, lean: 0.24 },
} as const;
