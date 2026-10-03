import { Color, Texture, Vector2, Vector4 } from 'three';

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
};
