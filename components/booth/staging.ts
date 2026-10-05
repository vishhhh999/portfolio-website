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
export type Staging = { object: Size3; base: Size3 & { kind: BaseKind }; x: number; z: number; scale?: number; yaw?: number; backing?: { w: number; h: number }; trayW?: number };

const sized = (o: Size3, s: number): Size3 => ({ w: o.w * s, h: o.h * s, d: o.d * s });

/**
 * B3 (07): ten objects, each fully visible from the home camera (projected boxes overlap ≤ 3%,
 * ≥ 8cm clear between any two, every sample ≥ 11% of the cabinet width: tools/check-sizes.mjs).
 * Width needed grows with depth (a back object must be ~35% wider than a front one to read the
 * same), so the narrow and the tall pieces stand in front:
 *   front row  Too Yumm · Bengal (on a wedge) · SOOK · SHUNYA (riser, dark backing) · House of Hex
 *   raised     the Mitooshi laptop · the Indo Thai tug · the Sonde tablet, between the two tall ends
 *   back, high the JSW book, closed, above the tug
 *   shelf      the About certificate (PROPS.ledge, top right)
 */
const FRONT_Z = 0.3;
const MID_Z = -0.12;
const BACK_Z = -0.35;
const GAP = 0.083;
/** Front row, left to right, packed from the left wall with GAP between objects. */
const FRONT: [string, number][] = [
  ['too-yumm', 0.1425 * 1.4],
  ['bengal-t20', 0.3 * 0.78],
  ['sook', 0.3016 * 0.78],
  ['shunya', 0.42 * 0.55],
  ['house-of-hex', 0.09 * 2.2],
];
const frontX: Record<string, number> = {};
{
  let left = -0.72;
  for (const [slug, w] of FRONT) {
    frontX[slug] = left + w / 2;
    left += w + GAP;
  }
}
const BENGAL_TILT = 0.8;

export const STAGING: Record<string, Staging> = {
  'too-yumm': { object: sized({ w: 0.1425, h: 0.24, d: 0.0752 }, 1.4), base: { kind: 'plinth', w: 0.23, d: 0.14, h: 0.04 }, x: frontX['too-yumm'], z: FRONT_Z, scale: 1.4 },
  'bengal-t20': {
    // the flat set on a sloped wedge, tilted 46° toward the camera (its own stand, not a box)
    object: sized({ w: 0.3, h: 0.2 * Math.sin(BENGAL_TILT) + 0.028, d: 0.2 * Math.cos(BENGAL_TILT) }, 0.78),
    base: { kind: 'plinth', w: 0.26, d: 0.14, h: 0.05 },
    x: frontX['bengal-t20'],
    z: FRONT_Z,
    scale: 0.78,
  },
  sook: { object: sized({ w: 0.3016, h: 0.1012, d: 0.0951 }, 0.78), base: { kind: 'plinth', w: 0.27, d: 0.12, h: 0.06 }, x: frontX.sook, z: FRONT_Z, scale: 0.78 },
  shunya: { object: sized({ w: 0.42, h: 0.0905, d: 0.27 }, 0.55), base: { kind: 'riser', w: 0.25, d: 0.17, h: 0.07 }, x: frontX.shunya, z: FRONT_Z - 0.01, scale: 0.55, backing: { w: 0.27, h: 0.19 } },
  'house-of-hex': { object: sized({ w: 0.09, h: 0.1758, d: 0.13 }, 2.2), base: { kind: 'plinth', w: 0.2, d: 0.2, h: 0.03 }, x: frontX['house-of-hex'], z: FRONT_Z - 0.04, scale: 2.2 },
  // raised middle: the laptop, the tug, the tablet
  mitooshi: { object: { w: 0.3152, h: 0.2125, d: 0.3035 }, base: { kind: 'plinth', w: 0.34, d: 0.3, h: 0.28 }, x: -0.394, z: MID_Z, scale: 1 },
  'indo-thai': { object: sized({ w: 6.73, h: 1.202, d: 5.7 }, 0.041), base: { kind: 'plinth', w: 0.3, d: 0.25, h: 0.22 }, x: -0.009, z: MID_Z + 0.02, scale: 0.041 },
  sonde: { object: sized({ w: 0.2821, h: 0.2399, d: 0.14 }, 1.08), base: { kind: 'plinth', w: 0.32, d: 0.2, h: 0.28 }, x: 0.372, z: MID_Z, scale: 1.08 },
  // back, high: the book
  // closed in the booth; on the tray it opens to two covers wide (trayW frames the open book)
  'jsw-sports': { object: sized({ w: 0.359, h: 0.275, d: 0.027 }, 0.8), base: { kind: 'plinth', w: 0.33, d: 0.14, h: 0.38 }, x: 0, z: BACK_Z, scale: 0.8, trayW: 0.359 * 0.8 * 2.05 },
};

/** The About object (B2): a small framed certificate standing on the shelf, top right. */
export const CERTIFICATE = { w: 0.16, h: 0.12, d: 0.012, x: 0.56, lean: 0.12 } as const;

/** Plinths: matte, Munsell N8.5, a touch warmer than the N8 walls. */
export const PLINTH_GREY = '#CBCAC6';
/** J3: a 3mm rounded bevel on every plinth edge, so the edges catch the light. */
export const PLINTH_CHAMFER = 0.003;

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

/** The shelf: a small ledge on the back wall, top right, where the About certificate stands (B1, B2). */
export const PROPS = {
  ledge: { x: 0.56, y: 0.62, w: 0.26, d: 0.06, h: 0.012 },
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
