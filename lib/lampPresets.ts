import { kelvinToAdapted } from './kelvin';
import type { Lamp } from './types';

export type RGB = [number, number, number];
type Vec3 = [number, number, number];

/** How a lamp comes on. Evaluated over t in [0, 1] of `strike.duration`. */
export type StrikeCurve = 'fluoro' | 'quickFluoro' | 'tungsten' | 'buzz' | 'flood' | 'screens' | 'handLamp';

/**
 * A soft light panel in the reflection environment: what glossy surfaces (screens, foil, glass,
 * the laptop lid) see. Positions are in booth units around the objects (y up, +z towards the viewer).
 */
export type Former = { pos: Vec3; size: [number, number]; colour: RGB; intensity: number };

export type LampPreset = {
  id: Lamp;
  label: string;
  ariaLabel: string;
  /** Quiet readout beside the name: 5000K, TL84, 2856K. */
  readout: string;
  key: string;
  /** Indicator dot: the lamp's own physical colour. */
  indicator: string;
  /**
   * The one shadow-casting light. Every lamp uses the same spot light (so a lamp change never
   * recompiles a shader); its position, cone and shadow radius make it a diffuser, a tungsten
   * lamp or a stadium flood. Position and target in metres for the wide booth (1.8 x 0.66 x 1.04),
   * scaled with the room for the others. It shines through the diffuser (the room casts no shadow).
   */
  key3: { colour: RGB; intensity: number; pos: Vec3; target: Vec3; angle: number; penumbra: number; radius: number; shadow: number };
  /** Sky and ground bounce (hemisphere). */
  fill: { sky: RGB; ground: RGB; intensity: number };
  /** The reflection environment (rendered once per lamp) and how strongly materials see it. */
  env: { formers: Former[]; intensity: number };
  /** How brightly the ceiling diffuser glows (0 = dark). */
  diffuser: number;
  diffuserColour: RGB;
  /** Device screens: emissive level, and how much light each throws onto the booth. */
  screens: { gain: number; spill: number };
  /** Fluorescence of white stock and the hidden notes (UV). */
  uv: number;
  /** FLOOD's beam haze. */
  haze: number;
  /** Exposure into the tone map. */
  exposure: number;
  strike: { duration: number; curve: StrikeCurve };
  /** Text over the booth turns light. */
  dark: boolean;
  /** Needs frames every tick while on (the hand lamp follows the pointer). */
  continuous: boolean;
};

/** Lamp colour as an eye adapted to D50 sees it; `amount` < 1 is partial adaptation (a lamp left on reads tinted, not monochrome). */
const K = (k: number, amount = 1): RGB => {
  const c = kelvinToAdapted(k);
  const m = c.map((v) => 1 - (1 - v) * amount);
  const max = Math.max(...m);
  return m.map((v) => v / max) as RGB;
};
const D50 = K(5000);
const TL84: RGB = [0.78, 1.0, 0.8];
const TUNGSTEN = K(2856, 0.72);
const FLOOD = K(6500);
const UV: RGB = [0.36, 0.12, 1];
const BLACK: RGB = [0, 0, 0];
const GREY = (v: number): RGB => [v, v, v];

/** The booth's own diffuser seen from the objects: a broad soft panel overhead, faint walls around. */
const diffuserEnv = (c: RGB, top: number, walls: number): Former[] => [
  { pos: [0, 1.4, -0.1], size: [2.2, 1.2], colour: c, intensity: top },
  { pos: [0, 0.4, -1.4], size: [3, 1.2], colour: c, intensity: walls },
  { pos: [-1.6, 0.5, 0], size: [1.2, 1.2], colour: c, intensity: walls * 0.8 },
  { pos: [1.6, 0.5, 0], size: [1.2, 1.2], colour: c, intensity: walls * 0.8 },
  { pos: [0, 0.6, 1.8], size: [2.6, 1], colour: c, intensity: walls * 0.6 },
];

export const LAMPS: LampPreset[] = [
  {
    id: 'D50', label: 'D50 Daylight', ariaLabel: 'Daylight, D50', readout: '5000K', key: '1', indicator: '#F4F3EE',
    // A soft overhead diffuser: high, broad, slightly forward. Shadows fall short and back, soft edged but clearly there.
    key3: { colour: D50, intensity: 16, pos: [0.15, 1.5, 0.75], target: [0, 0, -0.25], angle: 0.75, penumbra: 0.9, radius: 6, shadow: 0.95 },
    fill: { sky: D50, ground: GREY(0.42), intensity: 0.3 },
    env: { formers: diffuserEnv(D50, 2.4, 0.45), intensity: 0.5 },
    diffuser: 1.6, diffuserColour: D50,
    screens: { gain: 0.9, spill: 0 }, uv: 0, haze: 0, exposure: 0.88,
    strike: { duration: 0.3, curve: 'quickFluoro' }, dark: false, continuous: false,
  },
  {
    id: 'TL84', label: 'TL84 Store', ariaLabel: 'Store light, TL84', readout: '4000K', key: '2', indicator: '#E2F2D6',
    // A tube bank straight overhead: flatter (more bounce), cooler and greener, shadows short and under.
    key3: { colour: TL84, intensity: 9, pos: [0, 1.55, -0.12], target: [0, 0, 0.1], angle: 0.85, penumbra: 0.6, radius: 3.5, shadow: 0.8 },
    fill: { sky: TL84, ground: [0.46, 0.56, 0.44], intensity: 0.75 },
    env: { formers: [
      { pos: [-0.4, 1.4, -0.1], size: [0.18, 2.4], colour: TL84, intensity: 4 },
      { pos: [0, 1.4, -0.1], size: [0.18, 2.4], colour: TL84, intensity: 4 },
      { pos: [0.4, 1.4, -0.1], size: [0.18, 2.4], colour: TL84, intensity: 4 },
      ...diffuserEnv(TL84, 0, 0.6).slice(1),
    ], intensity: 1.0 },
    diffuser: 1.3, diffuserColour: TL84,
    screens: { gain: 0.9, spill: 0 }, uv: 0, haze: 0, exposure: 0.94,
    strike: { duration: 0.55, curve: 'fluoro' }, dark: false, continuous: false,
  },
  {
    id: 'A', label: 'A Home', ariaLabel: 'Home light, Illuminant A', readout: '2856K', key: '3', indicator: '#FFB45C',
    // One low tungsten lamp at the front right: long soft shadows raking left and back, a warm falloff.
    key3: { colour: TUNGSTEN, intensity: 5.5, pos: [1.25, 0.62, 1.15], target: [-0.35, 0.05, -0.4], angle: 0.6, penumbra: 0.85, radius: 9, shadow: 0.95 },
    fill: { sky: TUNGSTEN, ground: [0.25, 0.16, 0.09], intensity: 0.16 },
    env: { formers: [{ pos: [1.4, 0.6, 1.3], size: [0.5, 0.5], colour: TUNGSTEN, intensity: 9 }, { pos: [0, 0.4, -1.4], size: [3, 1.2], colour: TUNGSTEN, intensity: 0.08 }], intensity: 0.6 },
    diffuser: 0, diffuserColour: TUNGSTEN,
    screens: { gain: 0.75, spill: 0 }, uv: 0, haze: 0, exposure: 1.05,
    strike: { duration: 0.35, curve: 'tungsten' }, dark: true, continuous: false,
  },
  {
    id: 'UV', label: 'UV Blacklight', ariaLabel: 'Blacklight, UV', readout: '365nm', key: '4', indicator: '#8B5CFF',
    // Visible light almost gone, a violet glow from the tubes; white stock and the hidden notes fluoresce.
    key3: { colour: UV, intensity: 0.5, pos: [0, 1.6, 0.2], target: [0, 0, -0.1], angle: 0.85, penumbra: 1, radius: 8, shadow: 0.6 },
    fill: { sky: UV, ground: [0.03, 0.01, 0.06], intensity: 0.1 },
    env: { formers: diffuserEnv(UV, 0.9, 0.06), intensity: 0.3 },
    diffuser: 0.55, diffuserColour: [0.3, 0.1, 1],
    screens: { gain: 0.45, spill: 0 }, uv: 1, haze: 0, exposure: 1.1,
    strike: { duration: 0.6, curve: 'buzz' }, dark: true, continuous: false,
  },
  {
    id: 'FLOOD', label: 'Flood', ariaLabel: 'Stadium floodlight', readout: '6200K', key: '5', indicator: '#EAF2FF',
    // One hard, high, cold key: crisp short shadows, a bright pool with dark edges, haze in the beam.
    key3: { colour: FLOOD, intensity: 17, pos: [0.05, 1.95, 0.35], target: [0, 0, -0.05], angle: 0.42, penumbra: 0.3, radius: 1.2, shadow: 1 },
    fill: { sky: FLOOD, ground: GREY(0.05), intensity: 0.05 },
    env: { formers: [{ pos: [0, 1.8, 0.3], size: [0.35, 0.35], colour: FLOOD, intensity: 30 }], intensity: 0.7 },
    diffuser: 0, diffuserColour: FLOOD,
    screens: { gain: 0.6, spill: 0 }, uv: 0, haze: 1, exposure: 1.0,
    strike: { duration: 0.35, curve: 'flood' }, dark: true, continuous: false,
  },
  {
    id: 'SCREEN', label: 'Screen', ariaLabel: 'Screens only', readout: 'Emit', key: '6', indicator: '#C8F4FF',
    // Every lamp off; the devices' own screens are the only light, spilling onto the floor and neighbours.
    key3: { colour: BLACK, intensity: 0, pos: [0, 1.6, 0.6], target: [0, 0, 0], angle: 0.8, penumbra: 1, radius: 4, shadow: 0 },
    fill: { sky: [0.3, 0.35, 0.6], ground: BLACK, intensity: 0.025 },
    env: { formers: [{ pos: [0, 0.4, 1.6], size: [2, 0.6], colour: [0.4, 0.45, 0.8], intensity: 0.25 }], intensity: 0.5 },
    diffuser: 0, diffuserColour: BLACK,
    screens: { gain: 1.25, spill: 0.75 }, uv: 0, haze: 0, exposure: 1.0,
    strike: { duration: 0.5, curve: 'screens' }, dark: true, continuous: false,
  },
  {
    id: 'AFTERDARK', label: 'After Dark', ariaLabel: 'After dark, hand lamp', readout: 'Torch', key: '7', indicator: '#FF2A1A',
    // Total black; the key becomes a hand lamp that follows the pointer (aimed live by the rig).
    key3: { colour: K(3600, 0.8), intensity: 14, pos: [0, 0.75, 2.2], target: [0, 0.2, 0], angle: 0.13, penumbra: 0.6, radius: 2.5, shadow: 1 },
    fill: { sky: BLACK, ground: BLACK, intensity: 0 },
    env: { formers: [{ pos: [0, 0.7, 2], size: [0.2, 0.2], colour: K(3600, 0.8), intensity: 6 }], intensity: 0.35 },
    diffuser: 0, diffuserColour: BLACK,
    screens: { gain: 0.35, spill: 0.15 }, uv: 0, haze: 0, exposure: 1.1,
    strike: { duration: 0.45, curve: 'handLamp' }, dark: true, continuous: true,
  },
];

export const lampById = (id: Lamp) => LAMPS.find((l) => l.id === id)!;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Light output 0 to 1 at strike progress t. The old lamp is off the instant the switch flips; the
 * new one comes on the way the real thing does. Reduced motion skips straight to t = 1.
 *   D50    two quick flickers, then steady
 *   TL84   the starter clicks: dim glow, flash, dropout, a visible shimmer, steady
 *   A      a filament warm-up ramp
 *   UV     the ballast fades in, the fluorescence comes up last
 *   FLOOD  full at once, the eye adjusts (exposure overshoot)
 *   SCREEN the screens come up, then their spill
 *   AFTER DARK  a dark beat, then the torch clicks on
 */
export function strikeEnvelope(curve: StrikeCurve, t: number): number {
  if (t >= 1) return 1;
  switch (curve) {
    case 'flood':
    case 'screens':
      return 1;
    case 'quickFluoro':
      if (t < 0.2) return 0.1;
      if (t < 0.4) return 0.9;
      if (t < 0.55) return 0.15;
      return 1;
    case 'fluoro':
      if (t < 0.15) return 0.08;
      if (t < 0.3) return 0.85;
      if (t < 0.42) return 0.06;
      return t < 0.85 ? 0.82 + 0.18 * hash(Math.floor(t * 50)) : 1;
    case 'tungsten':
      return 1 - Math.pow(1 - t, 2.6);
    case 'buzz':
      return Math.min(1, t * 1.25) * (1 - (1 - t) * 0.25 * (0.5 + 0.5 * Math.sin(t * 120)));
    case 'handLamp':
      return t < 0.5 ? 0 : 1;
  }
}

export type StrikeChannels = { light: number; screens: number; spill: number; uv: number; exposure: number };

export function strikeChannels(curve: StrikeCurve, t: number): StrikeChannels {
  const light = strikeEnvelope(curve, t);
  if (t >= 1) return { light: 1, screens: 1, spill: 1, uv: 1, exposure: 1 };
  const smooth = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  switch (curve) {
    case 'buzz':
      return { light, screens: light, spill: light, uv: smooth(0.45, 1, t), exposure: 1 };
    case 'flood':
      return { light, screens: 1, spill: 1, uv: 1, exposure: 1 + 0.5 * Math.exp(-t * 6) * (1 - t) };
    case 'screens':
      return { light: 1, screens: smooth(0, 0.45, t), spill: smooth(0.35, 1, t), uv: 1, exposure: 1 };
    default:
      return { light, screens: light, spill: light, uv: light, exposure: 1 };
  }
}

/** Tungsten runs from deep amber to 2856K as it heats. */
export function strikeKelvin(curve: StrikeCurve, t: number): number | null {
  if (curve !== 'tungsten' || t >= 1) return null;
  return 1700 + (2856 - 1700) * Math.min(1, t * 1.2);
}
