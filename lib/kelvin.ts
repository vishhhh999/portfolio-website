/**
 * Colour temperature (K) to linear-light RGB, normalised so the max channel is 1.
 * Tanner Helland's blackbody fit (valid ~1000K–40000K), then sRGB -> linear.
 */
export function kelvinToSRGB(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number, g: number, b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }

  const clamp = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [clamp(r), clamp(g), clamp(b)];
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function kelvinToLinear(kelvin: number): [number, number, number] {
  const [r, g, b] = kelvinToSRGB(kelvin).map(srgbToLinear) as [number, number, number];
  const max = Math.max(r, g, b);
  return [r / max, g / max, b / max];
}
