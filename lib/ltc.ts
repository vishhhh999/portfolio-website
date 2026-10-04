'use client';

import { ClampToEdgeWrapping, DataTexture, DataUtils, FloatType, HalfFloatType, LinearFilter, NearestFilter, RGBAFormat, UniformsLib, UVMapping } from 'three';

/**
 * RectAreaLight lookup tables (what three's RectAreaLightUniformsLib.init() sets up), loaded from
 * public/booth/ltc.bin (tools/dump-ltc.mjs) instead of shipping them as JS literals. Must resolve
 * before the first frame with an area light.
 */
let ready: Promise<void> | null = null;
export function loadLTC() {
  ready ??= fetch('/booth/ltc.bin')
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      const all = new Float32Array(buf);
      const n = all.length / 2;
      const make = (data: Float32Array | Uint16Array, type: typeof FloatType | typeof HalfFloatType) => {
        const t = new DataTexture(data, 64, 64, RGBAFormat, type, UVMapping, ClampToEdgeWrapping, ClampToEdgeWrapping, LinearFilter, NearestFilter, 1);
        t.needsUpdate = true;
        return t;
      };
      const half = (f: Float32Array) => Uint16Array.from(f, (x) => DataUtils.toHalfFloat(x));
      const f1 = all.slice(0, n), f2 = all.slice(n);
      const lib = UniformsLib as unknown as Record<string, DataTexture>;
      lib.LTC_FLOAT_1 = make(f1, FloatType);
      lib.LTC_FLOAT_2 = make(f2, FloatType);
      lib.LTC_HALF_1 = make(half(f1), HalfFloatType);
      lib.LTC_HALF_2 = make(half(f2), HalfFloatType);
    });
  return ready;
}
