import { kelvinToAdapted } from './kelvin';
import type { Lamp } from './types';

export type RGB = [number, number, number];
type Vec3 = [number, number, number];

/** How a lamp comes on. Evaluated over t ∈ [0, 1] of `strike.duration`. */
export type StrikeCurve = 'fluoro' | 'quickFluoro' | 'tungsten' | 'instant' | 'buzz' | 'handLamp' | 'flood' | 'screens' | 'opening';

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
  /** How brightly the visible diffuser face glows (0 = dark glass). */
  diffuser: number;
  /** The one shadow-casting light. Position, cone and shadow radius set shadow direction and hardness. */
  keyLight: {
    intensity: number;
    colour: RGB;
    position: Vec3;
    target: Vec3;
    angle: number;
    penumbra: number;
    decay: number;
    /** VSM shadow blur radius: ~1 = hard edge, 8+ = soft. */
    shadowRadius: number;
    /** How dark the key's cast shadows are (0 = none: D50 grounds objects with contact shadows only). */
    shadowIntensity: number;
  };
  /** Bounce off the booth's N7 walls (hemisphere). */
  fill: { intensity: number; sky: RGB; ground: RGB };
  /** Light from the room in front of the booth opening (lights the lip, plate and front faces), 0–1. */
  front: number;
  /** Contact-shadow (blob) opacity: grounding under every plinth and sample. */
  contact: number;
  /** FLOOD's volumetric haze cone, 0–1. */
  haze: number;
  /** Device screens: emissive gain and spill-light intensity. */
  /** gain: emissive level; spill: each screen's area light; bounce: the screens' light back off the booth's interior, lighting the fronts (SCREEN). */
  screens: { gain: number; spill: number; bounce?: number };
  /** Fluorescence level (UV material chunk). */
  uv: number;
  bloom: { intensity: number; threshold: number };
  grain: number;
  /** Booth exposure into the tone map. B5: the room lamps (PBR Neutral) are set so under D50 the back wall reads L* 76–82 and white paper L* 88–94; the dark lamps (AgX) trimmed. */
  exposure: number;
  /**
   * 3×3 colour matrix (row-major, linear light) for spectral character only:
   * the narrow bands of a fluorescent, the dull blues under tungsten.
   * Never the main effect; the lights do that.
   */
  matrix: number[];
  /**
   * How this lamp lights the flat proof-strip photos (screen space, fixed to the
   * viewport like a lamp over the page). level × colour; a directional
   * gradient (dir points toward the light, amount = falloff across the screen);
   * an optional pool (FLOOD) or the hand lamp (AFTER DARK).
   */
  print: {
    level: number;
    colour: RGB;
    ambient: number;
    grad: [number, number, number];
    spot?: { x: number; y: number; r: number; soft: number; outside: number };
  };
  /** The room outside the booth (seen only on narrow screens), linear RGB at full lamp. */
  room: RGB;
  strike: { duration: number; curve: StrikeCurve };
  /** DOM over the booth switches to light text. */
  dark: boolean;
  /** Needs a continuous render loop (video, grain, hand lamp). */
  continuous: boolean;
};

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const BLACK: RGB = [0, 0, 0];
const OFF_KEY = { intensity: 0, colour: BLACK, position: [0, 0.78, 0.36] as Vec3, target: [0, 0, 0] as Vec3, angle: 0.8, penumbra: 1, decay: 2, shadowRadius: 4, shadowIntensity: 0 };
const SCREENS_ON = { gain: 0.5, spill: 0 };

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

/*
 * Booth interior: 1.5 wide × 0.8 high, back wall z −0.45, opening z +0.5 (0.95 deep, like a real
 * booth). Tiers at z −0.26, +0.04, +0.3. The diffuser fills the ceiling behind the hood
 * (1.36 × 0.68, centred at z −0.1). Light intensities are physical (candela for the key, nits for
 * the panel) at these distances.
 */
export const LAMPS: LampPreset[] = [
  {
    id: 'D50', label: 'D50 · Daylight', ariaLabel: 'Daylight, D50', readout: '5000K', spec: 'D50 · 5000K · CRI 98', key: '1', indicator: '#F4F3EE',
    // The full diffuser: even, near-shadowless light, broad soft speculars, a soft gradient down the back wall.
    panel: { intensity: 2.1, colour: D50, w: 1.36, d: 0.68, z: -0.1 },
    diffuser: 0.95,
    keyLight: { intensity: 1.6, colour: D50, position: [0.1, 0.78, 0.42], target: [0, 0.05, -0.15], angle: 1.4, penumbra: 1, decay: 2, shadowRadius: 9, shadowIntensity: 0.35 },
    fill: { intensity: 0.32, sky: D50, ground: [0.55, 0.55, 0.54] },
    front: 0.25,
    contact: 0.55, haze: 0,
    screens: SCREENS_ON, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0, exposure: 0.635, matrix: I3,
    print: { level: 1, colour: D50, ambient: 0, grad: [0, 1, 0.06] },
    room: [0.2, 0.2, 0.198],
    strike: { duration: 0.25, curve: 'quickFluoro' }, dark: false, continuous: false,
  },
  {
    id: 'TL84', label: 'TL84 · Store', ariaLabel: 'Store light, TL84', readout: 'TL84', spec: 'TL84 · 4000K · TRIBAND', key: '2', indicator: '#E6F2DC',
    // A tube bank set back over the row: top-light, front faces fall off, crisp shadows thrown
    // forward, narrow specular streaks on gloss. Floor stays within a stop (booth lamp).
    panel: { intensity: 2.9, colour: TL84, w: 1.36, d: 0.45, z: -0.14 },
    diffuser: 0.9,
    keyLight: { intensity: 1.5, colour: TL84, position: [0, 0.78, -0.38], target: [0, 0, 0.18], angle: 1.3, penumbra: 0.35, decay: 2, shadowRadius: 2.5, shadowIntensity: 0.55 },
    fill: { intensity: 0.42, sky: TL84, ground: [0.42, 0.45, 0.42] },
    front: 0.45,
    contact: 0.6, haze: 0,
    screens: SCREENS_ON, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0, exposure: 0.635,
    // Triband phosphors: reds lose saturation, greens push, cyan-blue shift.
    matrix: [0.86, 0.12, 0.02, 0.02, 1.0, -0.02, -0.02, 0.07, 0.95],
    print: { level: 0.97, colour: TL84, ambient: 0, grad: [0, 1, 0.14] },
    room: [0.17, 0.19, 0.17],
    strike: { duration: 0.25, curve: 'fluoro' }, dark: false, continuous: false,
  },
  {
    id: 'A', label: 'A · Home', ariaLabel: 'Home light, Illuminant A', readout: '2856K', spec: 'ILLUMINANT A · 2856K · TUNGSTEN', key: '3', indicator: '#FFB45C',
    // One low lamp at the front right: long soft shadows raking left and back, strong falloff across the row.
    panel: { intensity: 0, colour: TUNGSTEN, w: 1, d: 1, z: 0 },
    diffuser: 0,
    keyLight: { intensity: 9.5, colour: TUNGSTEN, position: [0.56, 0.46, 0.46], target: [-0.3, 0.08, -0.26], angle: 1.15, penumbra: 0.9, decay: 2, shadowRadius: 6, shadowIntensity: 0.8 },
    fill: { intensity: 0.13, sky: TUNGSTEN, ground: [0.3, 0.22, 0.15] },
    front: 0.04,
    contact: 0.45, haze: 0,
    screens: { gain: 0.42, spill: 0 }, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0, exposure: 0.675,
    // Tungsten has almost no blue: blues go dull and dark, reds and ambers bloom.
    matrix: [1.0, 0.02, -0.02, 0.03, 0.97, 0.0, 0.06, 0.06, 0.8],
    print: { level: 0.95, colour: TUNGSTEN, ambient: 0.05, grad: [0.82, 0.3, 0.62] },
    room: [0.08, 0.055, 0.035],
    strike: { duration: 0.18, curve: 'tungsten' }, dark: true, continuous: false,
  },
  {
    id: 'UV', label: 'UV · Blacklight', ariaLabel: 'Blacklight, UV', readout: 'UV-A', spec: 'UV-A · 365NM · FLUORESCENCE', key: '4', indicator: '#8B5CFF',
    // Visible light drops to a few percent, violet; paper whites and the hidden ink fluoresce.
    // A little violet ambient keeps every silhouette readable.
    panel: { intensity: 0.22, colour: UV_VIOLET, w: 1.36, d: 0.35, z: -0.2 },
    diffuser: 0.16,
    keyLight: { ...OFF_KEY },
    fill: { intensity: 0.13, sky: UV_VIOLET, ground: [0.08, 0.03, 0.16] },
    front: 0.0,
    contact: 0.3, haze: 0,
    screens: { gain: 0.3, spill: 0.3 }, uv: 1,
    bloom: { intensity: 0.32, threshold: 0.8 }, grain: 0.03, exposure: 0.8, matrix: I3,
    // non-fluorescing print reads near-black: only white ink and the hidden marks show, never a violet wash
    print: { level: 0.012, colour: UV_VIOLET, ambient: 0.004, grad: [0, 1, 0.2] },
    room: [0.02, 0.01, 0.05],
    strike: { duration: 0.6, curve: 'buzz' }, dark: true, continuous: false,
  },
  {
    id: 'FLOOD', label: 'Flood', ariaLabel: 'Stadium floodlight', readout: '5700K', spec: 'FLOOD · 5700K · METAL HALIDE', key: '5', indicator: '#EAF2FF',
    // One hard, high, cold key: crisp short shadows, a pool of light with dark edges, haze in the beam.
    panel: { intensity: 0, colour: FLOOD, w: 1, d: 1, z: 0 },
    diffuser: 0,
    keyLight: { intensity: 4.6, colour: FLOOD, position: [0.06, 0.78, 0.42], target: [0, 0.06, 0.09], angle: 1.02, penumbra: 0.4, decay: 2, shadowRadius: 1.5, shadowIntensity: 0.85 },
    fill: { intensity: 0.06, sky: FLOOD, ground: [0.1, 0.1, 0.11] },
    front: 0.02,
    contact: 0.7, haze: 1,
    screens: { gain: 0.45, spill: 0 }, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0.02, exposure: 0.45,
    matrix: [0.98, 0.03, -0.01, 0.0, 1.02, -0.02, -0.01, 0.02, 1.01],
    print: { level: 1.3, colour: FLOOD, ambient: 0, grad: [0, 1, 0], spot: { x: 0.5, y: 0.42, r: 0.62, soft: 0.3, outside: 0.05 } },
    room: [0.03, 0.03, 0.035],
    strike: { duration: 0.3, curve: 'flood' }, dark: true, continuous: false,
  },
  {
    id: 'SCREEN', label: 'Screen', ariaLabel: 'Screens only', readout: 'EMIT', spec: 'NO LAMPS · SCREEN EMISSION ONLY', key: '6', indicator: '#C8F4FF',
    // Every lamp off; the only light is the devices' own screens spilling onto the floor.
    panel: { intensity: 0, colour: BLACK, w: 1, d: 1, z: 0 },
    diffuser: 0,
    keyLight: { ...OFF_KEY },
    // G: no fill at all (it lit the walls blue with no visible source); the screens' own area
    // lights are the only light, strong enough that the nearest objects read faintly
    fill: { intensity: 0, sky: BLACK, ground: BLACK },
    front: 0.0,
    contact: 0.15, haze: 0,
    screens: { gain: 1.5, spill: 40, bounce: 0.25 }, uv: 0,
    bloom: { intensity: 0.6, threshold: 0.75 }, grain: 0.035, exposure: 0.45, matrix: I3,
    print: { level: 0.07, colour: [0.6, 0.7, 1], ambient: 0.025, grad: [0, -1, 0.3] },
    room: [0.005, 0.005, 0.007],
    strike: { duration: 0.5, curve: 'screens' }, dark: true, continuous: false,
  },
  {
    id: 'AFTERDARK', label: 'After Dark', ariaLabel: 'After dark, hand lamp', readout: 'TORCH', spec: 'ALL OFF · HAND LAMP · 3600K', key: '7', indicator: '#FF2A1A',
    // Total black. The key light becomes a hand lamp that follows the pointer (position set live by the rig).
    panel: { intensity: 0, colour: BLACK, w: 1, d: 1, z: 0 },
    diffuser: 0,
    keyLight: { intensity: 95, colour: kelvinToAdapted(3600), position: [0, 0.71, 1.78], target: [0, 0.15, 0], angle: 0.14, penumbra: 0.55, decay: 2, shadowRadius: 2, shadowIntensity: 0.8 },
    fill: { intensity: 0, sky: BLACK, ground: BLACK },
    front: 0.0,
    contact: 0, haze: 0,
    // devices stay dimly on: small glowing screens in the dark, the hand lamp reveals the rest
    screens: { gain: 0.22, spill: 0.5 }, uv: 0,
    bloom: { intensity: 0, threshold: 1 }, grain: 0.3, exposure: 0.55, matrix: I3,
    print: { level: 1.3, colour: kelvinToAdapted(3600), ambient: 0, grad: [0, 1, 0], spot: { x: 0.5, y: 0.5, r: 0.2, soft: 0.55, outside: 0 } },
    room: BLACK,
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
 * Strike envelope: light output 0–1 at strike progress t. The old lamp is off the instant the
 * rocker flips; the new one warms up the way the real thing does (D6), all skipped under reduced
 * motion (the strike jumps straight to t = 1):
 *   D50 / TL84  fluorescent: one or two quick flickers over 250ms, then steady
 *   A           incandescent: a warm ramp over 180ms (colour from strikeKelvin)
 *   UV          ballast: fades in over 600ms (the violet glow comes up last: strikeChannels)
 *   FLOOD       hits at once, the exposure overshoots and settles over 300ms
 *   SCREEN      the screens fade in first, their spill on the booth second
 *   AFTER DARK  cut to black, then the torch clicks on
 */
export function strikeEnvelope(curve: StrikeCurve, t: number): number {
  if (t >= 1) return 1;
  switch (curve) {
    case 'instant':
    case 'flood':
      return 1;
    case 'quickFluoro': {
      // two short dropouts, then on
      if (t < 0.18) return 0.06;
      if (t < 0.36) return 0.9;
      if (t < 0.5) return 0.12;
      if (t < 0.62) return 0.95;
      if (t < 0.7) return 0.3;
      return 1;
    }
    case 'fluoro': {
      // the starter clicks once: a dim glow, a flash, a dropout, steady (tri-phosphor: a touch green first)
      if (t < 0.22) return 0.1;
      if (t < 0.42) return 0.85;
      if (t < 0.58) return 0.08;
      return t < 0.8 ? 0.92 + 0.08 * hash(Math.floor(t * 40)) : 1;
    }
    case 'tungsten':
      // filament warm-up: slow start, ease to full
      return 1 - Math.pow(1 - t, 2.6);
    case 'buzz': {
      // the UV ballast: a fade with a faint 100Hz-ish shimmer settling out
      const f = 0.5 + 0.5 * Math.sin(t * 120);
      return Math.min(1, t * 1.25) * (1 - (1 - t) * 0.25 * f);
    }
    case 'screens':
      return 1;
    case 'handLamp':
      // dark beat, then the torch clicks on
      return t < 0.5 ? 0 : 1;
    case 'opening':
      // J5, the first visit: the booth dark, the D50 tubes strike: two flickers, then full (1.2s)
      if (t < 0.24) return 0;
      if (t < 0.3) return 0.8;
      if (t < 0.42) return 0.04;
      if (t < 0.47) return 0.9;
      if (t < 0.58) return 0.08;
      return t < 0.72 ? 0.85 + 0.15 * ((t - 0.58) / 0.14) : 1;
  }
}

export type StrikeChannels = { light: number; screens: number; spill: number; uv: number; exposure: number };

/** Per-channel warm-up (see strikeEnvelope): what each part of the rig does at strike progress t. */
export function strikeChannels(curve: StrikeCurve, t: number): StrikeChannels {
  const light = strikeEnvelope(curve, t);
  if (t >= 1) return { light: 1, screens: 1, spill: 1, uv: 1, exposure: 1 };
  const smooth = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  switch (curve) {
    case 'buzz':
      // fluorescence (the violet glow and the hidden ink) arrives last
      return { light, screens: light, spill: light, uv: smooth(0.45, 1, t), exposure: 1 };
    case 'flood':
      // metal halide arc: full output at once, the eye takes a beat to adjust (overshoot settles)
      return { light, screens: 1, spill: 1, uv: 1, exposure: 1 + 0.45 * Math.exp(-t * 6) * (1 - t) };
    case 'screens':
      return { light: 1, screens: smooth(0, 0.45, t), spill: smooth(0.35, 1, t), uv: 1, exposure: 1 };
    default:
      return { light, screens: light, spill: light, uv: light, exposure: 1 };
  }
}

/** Tungsten filament colour runs from deep amber to 2856K as it heats. */
export function strikeKelvin(curve: StrikeCurve, t: number): number | null {
  if (curve !== 'tungsten' || t >= 1) return null;
  return 1700 + (2856 - 1700) * Math.min(1, t * 1.2);
}
