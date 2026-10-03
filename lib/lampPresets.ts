import { kelvinToAdapted } from './kelvin';
import type { Lamp } from './types';

export type RGB = [number, number, number];
type Vec3 = [number, number, number];

/** How a lamp comes on. Evaluated over t ∈ [0, 1] of `strike.duration`. */
export type StrikeCurve = 'fluoro' | 'quickFluoro' | 'tungsten' | 'instant' | 'buzz' | 'handLamp';

export type LampPreset = {
  id: Lamp;
  label: string;
  ariaLabel: string;
  /** Mono spec readout on the switch, e.g. 5000K. */
  readout: string;
  /** Longer spec line shown in the panel status when active. */
  spec: string;
  key: string;
  /** Indicator LED: the lamp's own physical colour. */
  indicator: string;

  /** Ceiling fixture (RectAreaLight). Size and position change the light's shape, falloff and speculars. */
  panel: { intensity: number; colour: RGB; w: number; d: number; z: number };
  /** The one shadow-casting light. Position, cone and shadow radius set shadow direction and hardness. */
  keyLight: {
    intensity: number;
    colour: RGB;
    position: Vec3;
    target: Vec3;
    angle: number;
    penumbra: number;
    decay: number;
    /** PCF shadow radius: 1 = hard edge, 6+ = soft. */
    shadowRadius: number;
  };
  /** Bounce off the booth's N7 walls (hemisphere). */
  fill: { intensity: number; sky: RGB; ground: RGB };
  /** Grounding contact shadow opacity. */
  contact: number;
  /** FLOOD's volumetric haze cone, 0–1. */
  haze: number;
  /** Device screens: emissive gain and spill-light intensity. */
  screens: { gain: number; spill: number; playing: boolean };
  /** Fluorescence level (UV material chunk). */
  uv: number;
  bloom: { intensity: number; threshold: number };
  grain: number;
  /**
   * 3×3 colour matrix (row-major, linear light) for spectral character only:
   * the narrow bands of a fluorescent, the dull blues under tungsten.
   * Never the main effect; the lights do that.
   */
  matrix: number[];
  strike: { duration: number; curve: StrikeCurve };
  /** DOM over the booth switches to light text. */
  dark: boolean;
  /** Needs a continuous render loop (video, grain, hand lamp). */
  continuous: boolean;
};

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const BLACK: RGB = [0, 0, 0];
const OFF_KEY = { intensity: 0, colour: BLACK, position: [0, 2.3, 1] as Vec3, target: [0, 0, 0] as Vec3, angle: 0.6, penumbra: 1, decay: 2, shadowRadius: 4 };
const OFF_SCREENS = { gain: 0.9, spill: 0, playing: false };

/** Partial chromatic adaptation: the eye half-adjusts to a lamp left on, so off-D50 lamps read tinted, not monochrome. */
const adapt = (k: number, amount: number): RGB => {
  const c = kelvinToAdapted(k);
  return [1 - (1 - c[0]) * amount, 1 - (1 - c[1]) * amount, 1 - (1 - c[2]) * amount].map((v, _, a) => v / Math.max(...a)) as RGB;
};
const D50 = kelvinToAdapted(5000);
/** TL84: near-neutral 4000K white with the triband green spike. */
const TL84: RGB = [0.9, 1.0, 0.88];
const TUNGSTEN = adapt(2856, 0.68);
const FLOOD = kelvinToAdapted(5700);
const UV_VIOLET: RGB = [0.32, 0.1, 1];

export const LAMPS: LampPreset[] = [
  {
    id: 'D50', label: 'D50 · Daylight', ariaLabel: 'Daylight, D50', readout: '5000K', spec: 'D50 · 5000K · CRI 98', key: '1', indicator: '#F4F3EE',
    // Large diffuser over the whole visible floor: even, near-shadowless light, broad soft speculars.
    panel: { intensity: 1.75, colour: D50, w: 3.8, d: 4.4, z: 1.5 },
    keyLight: { intensity: 4, colour: D50, position: [0.2, 2.3, 1.6], target: [0, 0, -0.1], angle: 0.9, penumbra: 1, decay: 2, shadowRadius: 9 },
    fill: { intensity: 0.6, sky: D50, ground: [0.55, 0.55, 0.54] },
    contact: 0.5, haze: 0,
    screens: OFF_SCREENS, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0, matrix: I3,
    strike: { duration: 0.22, curve: 'quickFluoro' }, dark: false, continuous: false,
  },
  {
    id: 'TL84', label: 'TL84 · Store', ariaLabel: 'Store light, TL84', readout: 'TL84', spec: 'TL84 · 4000K · TRIBAND', key: '2', indicator: '#E6F2DC',
    // Tube bank set back over the row: top-light, front faces fall off, crisp shadows thrown
    // forward onto plinths and floor, narrow specular streaks. Floor stays within a stop (booth lamp).
    panel: { intensity: 1.35, colour: TL84, w: 3.4, d: 3.6, z: 1.4 },
    keyLight: { intensity: 6, colour: TL84, position: [0, 2.36, -0.45], target: [0, 0, 0.45], angle: 0.85, penumbra: 0.3, decay: 2, shadowRadius: 1.5 },
    fill: { intensity: 0.42, sky: TL84, ground: [0.42, 0.45, 0.42] },
    contact: 0.55, haze: 0,
    screens: OFF_SCREENS, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0,
    // Triband phosphors: reds lose saturation, greens push, cyan-blue shift.
    matrix: [0.86, 0.12, 0.02, 0.02, 1.0, -0.02, -0.02, 0.07, 0.95],
    strike: { duration: 0.42, curve: 'fluoro' }, dark: false, continuous: false,
  },
  {
    id: 'A', label: 'A · Home', ariaLabel: 'Home light, Illuminant A', readout: '2856K', spec: 'ILLUMINANT A · 2856K · TUNGSTEN', key: '3', indicator: '#FFB45C',
    // One low lamp off to the right: long soft shadows raking left, strong falloff across the row.
    panel: { intensity: 0, colour: TUNGSTEN, w: 1, d: 1, z: 0 },
    keyLight: { intensity: 34, colour: TUNGSTEN, position: [2.0, 0.8, 1.4], target: [-0.4, 0.1, -0.25], angle: 0.72, penumbra: 0.85, decay: 2, shadowRadius: 5 },
    fill: { intensity: 0.14, sky: TUNGSTEN, ground: [0.3, 0.22, 0.15] },
    contact: 0.4, haze: 0,
    screens: { gain: 0.7, spill: 0, playing: false }, uv: 0,
    bloom: { intensity: 0.15, threshold: 0.9 }, grain: 0,
    // Tungsten has almost no blue: blues go dull and dark, reds and ambers bloom.
    matrix: [1.0, 0.02, -0.02, 0.03, 0.97, 0.0, 0.06, 0.06, 0.8],
    strike: { duration: 0.6, curve: 'tungsten' }, dark: true, continuous: false,
  },
  {
    id: 'UV', label: 'UV · Blacklight', ariaLabel: 'Blacklight, UV', readout: 'UV-A', spec: 'UV-A · 365NM · FLUORESCENCE', key: '4', indicator: '#8B5CFF',
    // Base light drops to ~3%, violet; paper whites and the hidden ink fluoresce.
    panel: { intensity: 0.08, colour: UV_VIOLET, w: 3.6, d: 0.55, z: 0.15 },
    keyLight: { ...OFF_KEY },
    fill: { intensity: 0.05, sky: UV_VIOLET, ground: [0.05, 0.02, 0.12] },
    contact: 0.2, haze: 0,
    screens: { gain: 0.35, spill: 0.4, playing: false }, uv: 1,
    bloom: { intensity: 1.3, threshold: 0.45 }, grain: 0.04, matrix: I3,
    strike: { duration: 0.3, curve: 'buzz' }, dark: true, continuous: false,
  },
  {
    id: 'FLOOD', label: 'Flood', ariaLabel: 'Stadium floodlight', readout: '5700K', spec: 'FLOOD · 5700K · METAL HALIDE', key: '5', indicator: '#EAF2FF',
    // One hard, high, cold key: crisp short shadows, a pool of light with dark edges, haze in the beam.
    panel: { intensity: 0, colour: FLOOD, w: 1, d: 1, z: 0 },
    keyLight: { intensity: 26, colour: FLOOD, position: [0.3, 2.36, 1.2], target: [0, 0.05, -0.15], angle: 0.5, penumbra: 0.18, decay: 2, shadowRadius: 1 },
    fill: { intensity: 0.06, sky: FLOOD, ground: [0.1, 0.1, 0.11] },
    contact: 0.65, haze: 1,
    screens: { gain: 0.6, spill: 0, playing: false }, uv: 0,
    bloom: { intensity: 0.25, threshold: 0.95 }, grain: 0.02,
    matrix: [0.98, 0.03, -0.01, 0.0, 1.02, -0.02, -0.01, 0.02, 1.01],
    strike: { duration: 0.05, curve: 'instant' }, dark: true, continuous: false,
  },
  {
    id: 'SCREEN', label: 'Screen', ariaLabel: 'Screens only', readout: 'EMIT', spec: 'NO LAMPS · SCREEN EMISSION ONLY', key: '6', indicator: '#C8F4FF',
    // Every lamp off; the only light is the devices' own screens spilling onto the floor.
    panel: { intensity: 0, colour: BLACK, w: 1, d: 1, z: 0 },
    keyLight: { ...OFF_KEY },
    fill: { intensity: 0.012, sky: [0.6, 0.65, 0.8], ground: BLACK },
    contact: 0.12, haze: 0,
    screens: { gain: 2.4, spill: 14, playing: true }, uv: 0,
    bloom: { intensity: 0.8, threshold: 0.7 }, grain: 0.035, matrix: I3,
    strike: { duration: 0.05, curve: 'instant' }, dark: true, continuous: true,
  },
  {
    id: 'AFTERDARK', label: 'After Dark', ariaLabel: 'After dark, hand lamp', readout: 'TORCH', spec: 'ALL OFF · HAND LAMP · 3200K', key: '7', indicator: '#FF2A1A',
    // Total black. The key light becomes a hand lamp that follows the pointer (position set live by the rig).
    panel: { intensity: 0, colour: BLACK, w: 1, d: 1, z: 0 },
    keyLight: { intensity: 120, colour: kelvinToAdapted(3600), position: [0, 1.3, 3.2], target: [0, 0.15, 0], angle: 0.15, penumbra: 0.55, decay: 2, shadowRadius: 2 },
    fill: { intensity: 0, sky: BLACK, ground: BLACK },
    contact: 0, haze: 0,
    screens: { gain: 0, spill: 0, playing: false }, uv: 0,
    bloom: { intensity: 0.2, threshold: 0.9 }, grain: 0.32, matrix: I3,
    strike: { duration: 0.45, curve: 'handLamp' }, dark: true, continuous: true,
  },
];

export const lampById = (id: Lamp) => LAMPS.find((l) => l.id === id)!;

/** Fast deterministic hash for flicker noise. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Strike envelope: light output 0–1 at strike progress t.
 * The old lamp is off the instant the rocker flips; the new one strikes.
 */
export function strikeEnvelope(curve: StrikeCurve, t: number): number {
  if (t >= 1) return 1;
  switch (curve) {
    case 'instant':
      return 1;
    case 'quickFluoro': {
      // two short dropouts, then on
      if (t < 0.25) return 0.08;
      if (t < 0.45) return 0.85;
      if (t < 0.6) return 0.15;
      return 1;
    }
    case 'fluoro': {
      // starter-switch flicker: ~30ms steps, on-probability rising, then steady
      const step = Math.floor(t * 14);
      const on = hash(step) < 0.25 + t * 0.9;
      return t > 0.8 ? 1 : on ? 0.55 + 0.45 * hash(step + 9) : 0.04;
    }
    case 'tungsten':
      // filament warm-up: slow start, ease to full
      return 1 - Math.pow(1 - t, 2.6);
    case 'buzz': {
      // UV tubes buzz in: fast shallow flicker settling
      const f = 0.5 + 0.5 * Math.sin(t * 90);
      return Math.min(1, t * 1.6) * (1 - (1 - t) * 0.5 * f);
    }
    case 'handLamp':
      // dark beat, then the torch clicks on
      return t < 0.5 ? 0 : 1;
  }
}

/** Tungsten filament colour runs from deep amber to 2856K as it heats. */
export function strikeKelvin(curve: StrikeCurve, t: number): number | null {
  if (curve !== 'tungsten' || t >= 1) return null;
  return 1700 + (2856 - 1700) * Math.min(1, t * 1.2);
}
