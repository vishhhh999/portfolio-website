/**
 * Booth staging: the physical booth and the samples inside it, in metres.
 * Three.js world: Y-up, origin on the booth floor at the centre of the interior's width, +Z
 * towards the camera (out of the booth). Exported to tools/camera.json for the Blender scene.
 */

export type Size3 = { w: number; h: number; d: number };

/** What a sample stands on. Two or three plinth heights, one acrylic riser, one shallow tray. */
export type BaseKind = 'plinth' | 'riser' | 'tray';

/**
 * One sample: the object (display size: real size × scale), its base and where that base stands.
 * Three tiers like a proofing display: tall plinths at the back, a middle tier, low pieces at
 * the front. Small, tall pieces stand at the front corners so perspective does not shrink them
 * below 12% of the cabinet width (tools/check-sizes.mjs).
 */
export type Staging = { object: Size3; base: Size3 & { kind: BaseKind }; x: number; z: number; scale?: number; yaw?: number };

const sized = (o: Size3, s: number): Size3 => ({ w: o.w * s, h: o.h * s, d: o.d * s });

/**
 * F (06): four screen-space columns across the full cabinet width, each a front sample with a
 * raised one behind it, so no sample hides another (projected boxes overlap ≤ 3%, world gaps
 * ≥ 6cm, every sample ≥ 12% of the cabinet width: tools/check-sizes.mjs):
 *   left    Too Yumm (front)      · House of Hex high on a tall back column
 *   left-c  Bengal T20 (front)    · Mitooshi laptop raised behind it
 *   centre  SOOK (front, raised)  · the JSW book on the high back plinth (the hero shelf)
 *   right   SHUNYA (front, riser) · Sonde tablet raised behind it
 * The objects fill about 60–70% of the interior height; the camera sits a little lower.
 */
const FRONT_Z = 0.28;
const MID_Z = -0.15;
const BACK_Z = -0.34;

export const STAGING: Record<string, Staging> = {
  // front row: packaging and the match-day set, low
  'too-yumm': { object: sized({ w: 0.1425, h: 0.24, d: 0.0752 }, 1.45), base: { kind: 'plinth', w: 0.25, d: 0.14, h: 0.04 }, x: -0.58, z: FRONT_Z, scale: 1.45 },
  'bengal-t20': { object: sized({ w: 0.26, h: 0.06, d: 0.17 }, 1.15), base: { kind: 'plinth', w: 0.33, d: 0.15, h: 0.05 }, x: -0.255, z: FRONT_Z, scale: 1.15 },
  sook: { object: sized({ w: 0.3016, h: 0.1012, d: 0.0951 }, 1.3), base: { kind: 'plinth', w: 0.42, d: 0.15, h: 0.06 }, x: 0.155, z: FRONT_Z, scale: 1.3 },
  shunya: { object: sized({ w: 0.42, h: 0.0905, d: 0.27 }, 0.72), base: { kind: 'riser', w: 0.32, d: 0.21, h: 0.07 }, x: 0.575, z: FRONT_Z - 0.02, scale: 0.72 },
  // raised middle: the two screens
  mitooshi: { object: { w: 0.3, h: 0.21, d: 0.24 }, base: { kind: 'plinth', w: 0.36, d: 0.26, h: 0.3 }, x: -0.26, z: MID_Z, scale: 1 },
  sonde: { object: sized({ w: 0.25, h: 0.19, d: 0.15 }, 1.15), base: { kind: 'plinth', w: 0.3, d: 0.24, h: 0.3 }, x: 0.58, z: MID_Z, scale: 1.15 },
  // high back: the hero shelf (the book) and the phone's tall column
  'jsw-sports': { object: sized({ w: 0.564, h: 0.2747, d: 0.22 }, 0.75), base: { kind: 'plinth', w: 0.46, d: 0.18, h: 0.4 }, x: 0.165, z: BACK_Z, scale: 0.75 },
  'house-of-hex': { object: sized({ w: 0.13, h: 0.17, d: 0.09 }, 1.9), base: { kind: 'plinth', w: 0.22, d: 0.18, h: 0.43 }, x: -0.6, z: -0.25, scale: 1.9 },
  // archive-only: never staged in the lineup; sizes kept for the tray
  'indo-thai': { object: { w: 0.3, h: 0.21, d: 0.24 }, base: { kind: 'plinth', w: 0.36, d: 0.3, h: 0.1 }, x: 0, z: 0 },
};

/** Plinths: matte, Munsell N8, a touch warmer than the N7 walls. */
export const PLINTH_GREY = '#BDBCB8';
/** 2mm bevel on every plinth edge. */
export const PLINTH_CHAMFER = 0.002;

/**
 * The booth: an open-fronted box with coved inside corners. Interior width × height × depth;
 * the back wall at backZ, the opening (with its front lip) at frontZ. A real viewing booth is
 * shallow: 0.95m deep.
 */
export const BOOTH = { width: 1.5, height: 0.8, backZ: -0.45, frontZ: 0.5, wall: 0.04 } as const;
/** 20mm coves where the walls meet the floor and the back wall. */
export const COVE = 0.02;
/** Front lip at the opening: a low raised sill. */
export const LIP = { h: 0.022, d: 0.04 } as const;
/**
 * The housing seen from outside: a satin black anodised frame around the opening (posts, a deep
 * lamp hood at the top, a sill under the opening, a shallow base), standing `proud` of the box.
 */
export const CABINET = { post: 0.035, header: 0.09, sill: 0.055, base: 0.02, proud: 0.025, chamfer: 0.004 } as const;
/** Outer front-face size of the cabinet, and its bottom (world y). */
export const CABINET_FACE = {
  w: BOOTH.width + 2 * CABINET.post,
  h: BOOTH.height + CABINET.header + CABINET.sill + CABINET.base,
  bottom: -CABINET.sill - CABINET.base,
} as const;
/** The cabinet's front plane (world z). */
export const FACE_Z = BOOTH.frontZ + CABINET.proud;
/**
 * The hood: a sloped valance inside the top of the opening that hides the tubes from the viewer,
 * and the opal diffuser panel recessed in the ceiling behind it.
 */
export const HOOD = { drop: 0.055, run: 0.11 } as const;
export const DIFFUSER = { w: 1.36, d: 0.68, z: -0.1 } as const;

/**
 * Proofing tray at the front centre, raised on a short pedestal so the sample clears the lip: where
 * the active sample is examined. Hidden until in use. `top` is the height of the plate's upper face.
 */
export const TRAY = { z: 0.3, w: 0.46, d: 0.24, h: 0.008, stand: 0.11, top: 0.118 } as const;
/** How far the lineup steps back while something is on the tray. */
export const RECEDE_DZ = -0.1;

/**
 * Lens: ~38mm full-frame equivalent → 2·atan(12/38) ≈ 35° vertical FOV. The camera sits a little
 * above the plinth line and looks 7° down into the booth.
 */
export const FOV = 35;
export const SENSOR_HEIGHT_MM = 24;
export const FOCAL_MM = SENSOR_HEIGHT_MM / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
export const EYE = { y: 0.37, pitchDeg: -6 } as const;

/** Calibration props: a small ledge on the back wall, right of centre. */
export const PROPS = {
  ledge: { x: 0.56, y: 0.6, w: 0.32, d: 0.05, h: 0.012 },
  /** Mini 24-patch chart: half the classic size. */
  checker: { x: 0.64, w: 0.14, h: 0.108, lean: 0.22, yaw: -0.16 },
  card: { x: 0.5, w: 0.1, h: 0.067, lean: 0.26, yaw: 0.1 },
  /** Glossy laminated swatch: catches the lamp's reflection (TL84 tubes show as streaks). */
  gloss: { x: 0.43, w: 0.07, h: 0.1, lean: 0.42, yaw: 0.18 },
} as const;

/** Base positions for a set of lineup slugs (explicit staging, not computed). */
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
