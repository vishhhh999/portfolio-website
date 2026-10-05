import type { Size3, Staging } from './staging.ts';

/**
 * G (08): the phone arrangement. The 4:5 portrait box frames the middle of the same booth (the
 * cabinet's full height), so all ten objects are gathered there in three tiers at one display scale
 * (PHONE_K × real size; the tug keeps its own model ratio, shown on its plate). Every object stays
 * in frame at ≥ 14% of the box width (long side), boxes overlap ≤ 3%, ≥ 5cm clear
 * (tools/check-sizes.mjs at 390x844 and 430x932).
 */
export const PHONE_K = 0.68;
const s = (w: number, h: number, d: number): Size3 => ({ w: w * PHONE_K, h: h * PHONE_K, d: d * PHONE_K });
const TUG = PHONE_K / 24;
const T = 0.8;
const FRONT_Z = 0.28;
const MID_Z = 0.0;
const BACK_Z = -0.3;

export const PHONE_STAGING: Record<string, Staging> = {
  'bengal-t20': { object: s(0.3, 0.2 * Math.sin(T) + 0.028, 0.2 * Math.cos(T)), base: { kind: 'plinth', w: 0.22, d: 0.12, h: 0.04 }, x: -0.22, z: FRONT_Z, scale: PHONE_K },
  'too-yumm': { object: s(0.1425, 0.24, 0.0752), base: { kind: 'plinth', w: 0.12, d: 0.09, h: 0.05 }, x: 0.0, z: FRONT_Z, scale: PHONE_K },
  'house-of-hex': { object: s(0.09, 0.1758, 0.13), base: { kind: 'plinth', w: 0.1, d: 0.1, h: 0.06 }, x: 0.2, z: FRONT_Z, scale: PHONE_K },
  mitooshi: { object: s(0.3152, 0.2125, 0.3035), base: { kind: 'plinth', w: 0.23, d: 0.21, h: 0.24 }, x: -0.26, z: MID_Z, scale: PHONE_K },
  'indo-thai': { object: { w: 6.73 * TUG, h: 1.202 * TUG, d: 5.7 * TUG }, base: { kind: 'plinth', w: 0.21, d: 0.18, h: 0.27 }, x: 0.0, z: MID_Z, scale: TUG, plate: `1:${Math.round(1 / TUG)}` },
  sonde: { object: s(0.2821, 0.2399, 0.14), base: { kind: 'plinth', w: 0.21, d: 0.12, h: 0.24 }, x: 0.26, z: MID_Z, scale: PHONE_K },
  shunya: { object: s(0.42, 0.0905, 0.27), base: { kind: 'riser', w: 0.28, d: 0.19, h: 0.44 }, x: -0.29, z: BACK_Z, scale: PHONE_K, sweep: { w: 0.29, h: 0.08, r: 0.035 } },
  sook: { object: s(0.3016, 0.1012, 0.0951), base: { kind: 'plinth', w: 0.22, d: 0.09, h: 0.44 }, x: 0.02, z: BACK_Z, scale: PHONE_K },
  'jsw-sports': { object: s(0.359, 0.275, 0.027), base: { kind: 'plinth', w: 0.26, d: 0.08, h: 0.44 }, x: 0.30, z: BACK_Z, scale: PHONE_K, trayW: 0.359 * PHONE_K * 2.05, trayX: (-0.359 * PHONE_K) / 2 },
};

/** The shelf and the certificate, top centre-left of the phone frame. */
export const PHONE_PROPS = {
  ledge: { x: -0.12, y: 0.565, w: 0.24, d: 0.06, h: 0.012 },
  certificate: { w: 0.16, h: 0.12, d: 0.012, x: -0.12, lean: 0.12 },
};
