/**
 * Booth staging: the physical booth and the samples inside it, in metres.
 * Three.js world: Y-up, origin on the booth floor at the centre of the interior's width, +Z
 * towards the camera (out of the booth). Exported to tools/camera.json for the Blender scene.
 */

export type Size3 = { w: number; h: number; d: number };

/** What a sample stands on. Two or three plinth heights, one acrylic riser, one shallow tray. */
export type BaseKind = 'plinth' | 'riser' | 'tray' | 'none';

/**
 * One sample: the object (display size: real size × scale), its base and where that base stands.
 * Three tiers like a proofing display: tall plinths at the back, a middle tier, low pieces at
 * the front. Small, tall pieces stand at the front corners so perspective does not shrink them
 * below 12% of the cabinet width (tools/check-sizes.mjs).
 */
import { PHONE_PROPS, PHONE_STAGING } from './phoneStaging.ts';
import { shelfLayout, type ShelfDef } from './shelf.ts';
import { JSW_OPEN, scaledBox, type TrayBox } from './trayBox.ts';
/** `y` (L3 09B): the floor the slot stands on (a shelf board's top; 0 = the booth floor). */
export type Staging = { object: Size3; base: Size3 & { kind: BaseKind }; x: number; y?: number; z: number; scale?: number; yaw?: number; sweep?: { w: number; h: number; r: number }; plate?: string; trayBox?: TrayBox };

export const sized = (o: Size3, s: number): Size3 => ({ w: o.w * s, h: o.h * s, d: o.d * s });

/**
 * E (08): one display scale for every sample: K = 1, real size. The pieces keep their true relative
 * sizes (the phone is a phone next to the laptop). The Indo Thai tug is the one scale model, and is
 * shown as one: 1:24, with an engraved plate on its plinth.
 * Rules (tools/check-sizes.mjs, sizeFloor below): each sample's long side (width, or height for a
 * portrait piece) ≥ 11% of the cabinet width, or ≥ 9% on a raised plinth with nothing taller in
 * front of it; projected boxes overlap ≤ 3%; ≥ 8cm clear between any two. Three tiers, each row
 * raised so it reads over the one in front:
 *   front   Bengal (on a wedge) · the 1:24 tug · the Sonde tablet
 *   middle  the Mitooshi laptop · Too Yumm · SHUNYA (high riser, N5.5 sweep card) · the House of Hex phone (raised)
 *   back    SOOK (left, high) · the JSW book, closed (centre, high)
 *   shelf   the About certificate (PROPS.ledge, top right)
 */
export const K = 1.0;
/** The tug's model scale: 1:24 (6.73m with the tow bar → 0.28m). */
export const TUG_SCALE = 1 / 24;
const FRONT_Z = 0.3;
const MID_Z = -0.1;
const BACK_Z = -0.37;
const BENGAL_TILT = 0.8;
const real = (w: number, h: number, d: number): Size3 => sized({ w, h, d }, K);

export const DESKTOP_STAGING: Record<string, Staging> = {
  // front row, low
  'too-yumm': { object: real(0.1425, 0.24, 0.0752), base: { kind: 'plinth', w: 0.2, d: 0.13, h: 0.15 }, x: -0.16, z: -0.1, scale: K },
  'bengal-t20': {
    // the flat set on a sloped wedge, tilted 46° toward the camera (its own stand, not a box)
    object: real(0.3, 0.2 * Math.sin(BENGAL_TILT) + 0.028, 0.2 * Math.cos(BENGAL_TILT)),
    base: { kind: 'plinth', w: 0.36, d: 0.18, h: 0.05 },
    x: -0.5,
    z: FRONT_Z,
    scale: K,
  },
  'indo-thai': { object: sized({ w: 6.73, h: 1.202, d: 5.7 }, TUG_SCALE), base: { kind: 'plinth', w: 0.33, d: 0.27, h: 0.12 }, x: 0.0, z: FRONT_Z - 0.02, scale: TUG_SCALE, plate: '1:24' },
  // H1 (09): the phone moves to the front row on a taller plinth: nearer the camera, so it reads
  // bigger at its true size
  'house-of-hex': { object: real(0.09, 0.1758, 0.13), base: { kind: 'plinth', w: 0.14, d: 0.16, h: 0.22 }, x: 0.66, z: FRONT_Z + 0.02, scale: K },
  sonde: { object: real(0.2821, 0.2399, 0.14), base: { kind: 'plinth', w: 0.34, d: 0.19, h: 0.05 }, x: 0.37, z: FRONT_Z, scale: K },
  // middle row, raised
  // A5 (09): the rebuilt laptop (lid at 110 degrees), its GLB bounds; the model is centred on its footprint
  mitooshi: { object: real(0.3126, 0.2123, 0.3011), base: { kind: 'plinth', w: 0.38, d: 0.34, h: 0.24 }, x: -0.5, z: MID_Z, scale: K },
  shunya: { object: real(0.42, 0.0905, 0.27), base: { kind: 'riser', w: 0.44, d: 0.3, h: 0.29 }, x: 0.235, z: MID_Z, scale: K, sweep: { w: 0.46, h: 0.12, r: 0.05 } },
  // back, high
  sook: { object: real(0.3016, 0.1012, 0.0951), base: { kind: 'plinth', w: 0.36, d: 0.13, h: 0.53 }, x: -0.42, z: -0.385, scale: K },
  // closed in the booth; on the tray it opens (A7 09: the tray shot frames the open book, JSW_OPEN)
  'jsw-sports': { object: real(0.359, 0.275, 0.027), base: { kind: 'plinth', w: 0.42, d: 0.12, h: 0.42 }, x: 0.04, z: BACK_Z, scale: K, trayBox: scaledBox(JSW_OPEN, K) },
};

/**
 * The size floor for a sample (% of the cabinet width, long side): 11, or 9 when it stands on a
 * raised plinth (≥ 20cm) and nothing in front of it, across its width, rises above its base.
 */
export function sizeFloor(slug: string) {
  const STAGING = DESKTOP_STAGING;
  const st = STAGING[slug];
  if (st.base.h < 0.2) return 11;
  const x0 = st.x - st.object.w / 2, x1 = st.x + st.object.w / 2;
  for (const [k, o] of Object.entries(STAGING)) {
    if (k === slug || o.z - o.object.d / 2 <= st.z + st.object.d / 2) continue;
    if (o.x + o.object.w / 2 < x0 || o.x - o.object.w / 2 > x1) continue;
    if (o.base.h + o.object.h > st.base.h) return 11;
  }
  return 9;
}

/** The About object (B2; H2 09: 1.25× the 07 size, it was 1.6× and competed with the JSW book): a framed certificate on the shelf, top right, under its own soft spot. */
const DESKTOP_CERTIFICATE = { w: 0.2, h: 0.15, d: 0.014, x: 0.52, lean: 0.12, z: -0.45 + 0.035 };

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
export const CABINET = { post: 0.035, header: 0.045, sill: 0.055, base: 0.02, proud: 0.025, chamfer: 0.004 } as const;
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
export const DESKTOP_PROPS = {
  ledge: { x: 0.52, y: 0.505, w: 0.34, d: 0.07, h: 0.012 },
  certificate: DESKTOP_CERTIFICATE,
};

/**
 * L2 (09B): the arrangement is chosen at runtime by the page's shape (lib/shape.ts) and route, and can
 * change while the page is open (a window drag, an iPad rotation):
 *   wide     the cabinet, the desktop arrangement (wide and phone-landscape shapes)
 *   square   the cabinet framed square, the samples gathered into its middle in three tiers
 *            (phoneStaging.ts; square shapes, and the project tray on tall screens)
 *   shelf2   the wall shelf, two columns (tall shapes under 600px wide, home)
 *   shelf3   the wall shelf, three columns (tall shapes from 600px, home)
 * STAGING, PROPS and CERTIFICATE always describe the active arrangement (the server and the tools
 * see `wide`). Models and textures are shared across arrangements: only transforms, bases, the
 * camera and the AO map change.
 */
export type LayoutKey = 'wide' | 'square' | 'shelf2' | 'shelf3';
export type Ledge = { x: number; y: number; w: number; d: number; h: number };
export type CertificateSpec = { w: number; h: number; d: number; x: number; lean: number; z: number };
export type LayoutDef = {
  key: LayoutKey;
  kind: 'cabinet' | 'shelf';
  staging: Record<string, Staging>;
  ledge: Ledge;
  certificate: CertificateSpec;
  /** The baked AO over this arrangement's atlas (uv1). */
  ao: string;
  shelf?: ShelfDef;
};
const defs = new Map<LayoutKey, LayoutDef>();
export function layoutDef(key: LayoutKey): LayoutDef {
  const hit = defs.get(key);
  if (hit) return hit;
  let d: LayoutDef;
  if (key === 'wide') d = { key, kind: 'cabinet', staging: DESKTOP_STAGING, ledge: DESKTOP_PROPS.ledge, certificate: DESKTOP_CERTIFICATE, ao: '/booth/ao.png' };
  else if (key === 'square') d = { key, kind: 'cabinet', staging: PHONE_STAGING, ledge: PHONE_PROPS.ledge, certificate: { ...PHONE_PROPS.certificate, z: BOOTH.backZ + 0.035 }, ao: '/booth/ao-phone.png' };
  else {
    const shelf = shelfLayout(DESKTOP_STAGING, key === 'shelf2' ? 2 : 3);
    d = { key, kind: 'shelf', staging: shelf.staging, ledge: shelf.ledge, certificate: { ...DESKTOP_CERTIFICATE, ...shelf.certificate }, ao: `/booth/ao-${key}.png`, shelf: shelf.def };
  }
  defs.set(key, d);
  return d;
}

let active: LayoutDef | null = null;
const current = () => (active ??= layoutDef('wide'));
export const activeLayout = () => current();
const layoutListeners = new Set<() => void>();
/** Makes `key` the active arrangement; listeners (the canvas, the frame) re-render on it. */
export function setActiveLayout(key: LayoutKey) {
  if (current().key === key) return;
  active = layoutDef(key);
  Object.assign(PROPS.ledge, active.ledge);
  Object.assign(CERTIFICATE, active.certificate);
  layoutListeners.forEach((l) => l());
}
export function onLayoutChange(cb: () => void) {
  layoutListeners.add(cb);
  return () => void layoutListeners.delete(cb);
}

/** The arrangement for a shape and a route (home: the full booth; a project page: the tray header). */
export function layoutKeyFor(shape: string, columns: number, mode: 'full' | 'header' | 'off'): LayoutKey {
  if (shape === 'tall') return mode === 'full' ? (columns === 2 ? 'shelf2' : 'shelf3') : 'square';
  if (shape === 'square') return 'square';
  return 'wide';
}

/** The active arrangement's samples (a live view: always the current layout). */
export const STAGING: Record<string, Staging> = new Proxy({} as Record<string, Staging>, {
  get: (_, k) => (typeof k === 'string' ? current().staging[k] : undefined),
  has: (_, k) => typeof k === 'string' && k in current().staging,
  ownKeys: () => Reflect.ownKeys(current().staging),
  getOwnPropertyDescriptor: (_, k) => (typeof k === 'string' && k in current().staging ? { value: current().staging[k], enumerable: true, configurable: true, writable: false } : undefined),
});
export const PROPS = { ledge: { ...DESKTOP_PROPS.ledge } };
export const CERTIFICATE: CertificateSpec = { ...DESKTOP_CERTIFICATE };

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
