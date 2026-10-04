import { Color, Matrix3, Texture, Vector2, Vector4 } from 'three';

/**
 * Shared lighting uniforms for every proof-strip plane, written by the lamp
 * rig each frame from the active preset's `print` model (same strike
 * envelope, same colours as the booth). Coordinates are drawing-buffer pixels.
 */
export const proofUniforms = {
  uColour: { value: new Color(1, 1, 1) },
  uAmbient: { value: 0 },
  uGrad: { value: new Vector4(0, 1, 0, 0) }, // dir.xy, amount
  uSpot: { value: new Vector4(0, 0, 1, 0.5) }, // centre.xy, radius, softness
  uSpotMix: { value: 0 },
  uSpotOutside: { value: 0 },
  uCookie: { value: null as Texture | null },
  uUseCookie: { value: 0 },
  uBuffer: { value: new Vector2(1, 1) },
  /** Minimum luminance of the print light (relative to D50 = 1) so work stays readable under dark lamps. */
  uFloor: { value: 0 },
  /** AFTER DARK torch strength on proofs (the strike envelope), never above 1. */
  uTorchLevel: { value: 1 },
  /** UV glow on prints: 0 until the visitor picks UV themselves. */
  uProofUV: { value: 0 },
  /** Cancels the post colour matrix while the photos stay D50-faithful (identity once a lamp is picked). */
  uNeutralize: { value: new Matrix3() },
};

/** Readability floors per lamp, once the visitor has picked it. */
export const PRINT_FLOORS: Partial<Record<string, number>> = { SCREEN: 0.3, UV: 0.15, AFTERDARK: 0.1 };
