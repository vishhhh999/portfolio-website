import { CanvasTexture, Color, Vector4, type Material, type Texture } from 'three';

/**
 * UV (blacklight) material system. One set of shared uniforms drives every
 * material in the booth (and the proof-strip planes), so a lamp change is one
 * uniform write, not a traversal.
 *
 * Texture slots, authored in Blender for real assets (Phase 4):
 *   fluorMask  RGB, uv-mapped: where and in what tint the surface fluoresces
 *   uvInk      R,   uv-mapped: the proofer's hidden annotation layer
 * Placeholders (no authored UV layout) use:
 *   fluor      constant fluorescence amount
 *   inkProj    ink projected along the mesh's local +Z onto front-facing
 *              surfaces, so it prints on (and follows) curved pages and screens
 *              instead of floating in front of them.
 * The emission is added just before output, so it works on Standard, Physical
 * and Basic materials alike.
 */
export const uvUniforms = {
  uUV: { value: 0 },
  /** Violet-white: optical brighteners in paper under UV-A. */
  uFluorColor: { value: new Color(0.55, 0.48, 1.0) },
  /** Pale cyan: fluorescent ink. */
  uInkColor: { value: new Color(0.62, 1.0, 0.9) },
  uFluorGain: { value: 1.25 },
  uInkGain: { value: 1.35 },
};

export type InkProjection = {
  map: Texture;
  /** Local-space rectangle the ink covers: [x0, y0, x1, y1]. */
  box: [number, number, number, number];
};

export type UVOptions = {
  fluor?: number;
  fluorMask?: Texture | null;
  uvInk?: Texture | null;
  inkProj?: InkProjection | null;
};

export function applyUV(material: Material, opts: UVOptions = {}) {
  const hasMask = !!opts.fluorMask;
  const hasInk = !!opts.uvInk;
  const hasProj = !!opts.inkProj;
  const local = {
    uFluor: { value: opts.fluor ?? (hasMask ? 1 : 0) },
    uFluorMask: { value: opts.fluorMask ?? null },
    uUvInk: { value: opts.uvInk ?? null },
    uInkProj: { value: opts.inkProj?.map ?? null },
    uInkBox: { value: new Vector4(...(opts.inkProj?.box ?? [0, 0, 1, 1])) },
  };
  material.userData.uv = local;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uvUniforms, local);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBoothUv;\nvarying vec3 vBoothPos;\nvarying vec3 vBoothNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBoothUv = uv;\nvBoothPos = position;\nvBoothNormal = normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vBoothUv; varying vec3 vBoothPos; varying vec3 vBoothNormal;
        uniform float uUV, uFluor, uFluorGain, uInkGain;
        uniform vec3 uFluorColor, uInkColor;
        uniform vec4 uInkBox;
        ${hasMask ? 'uniform sampler2D uFluorMask;' : ''}
        ${hasInk ? 'uniform sampler2D uUvInk;' : ''}
        ${hasProj ? 'uniform sampler2D uInkProj;' : ''}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 boothUV = vec3(0.0);
          vec3 fluorTint = ${hasMask ? 'texture2D(uFluorMask, vBoothUv).rgb' : 'vec3(1.0)'};
          boothUV += uFluor * uFluorGain * uFluorColor * fluorTint;
          ${hasInk ? 'boothUV += uInkGain * uInkColor * texture2D(uUvInk, vBoothUv).r;' : ''}
          ${
            hasProj
              ? `{
            vec2 p = (vBoothPos.xy - uInkBox.xy) / (uInkBox.zw - uInkBox.xy);
            float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
            float facing = smoothstep(0.35, 0.8, normalize(vBoothNormal).z);
            boothUV += uInkGain * uInkColor * texture2D(uInkProj, clamp(p, 0.0, 1.0)).r * inside * facing;
          }`
              : ''
          }
          outgoingLight += uUV * boothUV;
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `booth-uv-${hasMask}-${hasInk}-${hasProj}`;
  material.needsUpdate = true;
}

/**
 * A work's uvNotes as a proofer's hidden marks: sparse construction lines,
 * corner ticks and short handwritten-style notes. Deliberately not a framed
 * HUD panel: it should read as ink on the object.
 */
export function createInkTexture(notes: string[], aspect: number, seed = 1) {
  const W = 1024;
  const H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  let r = seed * 9301;
  const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280;

  // construction: a centre line, a thirds line and corner ticks, faint
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 2;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.moveTo(W / 2, H * 0.04);
  g.lineTo(W / 2, H * 0.96);
  g.moveTo(W * 0.04, H / 3);
  g.lineTo(W * 0.96, H / 3);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 3;
  const t = Math.min(W, H) * 0.06;
  for (const [x, y, sx, sy] of [
    [W * 0.08, H * 0.08, 1, 1],
    [W * 0.92, H * 0.08, -1, 1],
    [W * 0.08, H * 0.92, 1, -1],
    [W * 0.92, H * 0.92, -1, -1],
  ] as const) {
    g.beginPath();
    g.moveTo(x + sx * t, y);
    g.lineTo(x, y);
    g.lineTo(x, y + sy * t);
    g.stroke();
  }

  // notes: handwritten-ish, small, slightly rotated, each with a leader mark
  const size = Math.max(26, Math.min(44, H / (notes.length * 3.2)));
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.font = `italic 500 ${size}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive, sans-serif`;
  notes.forEach((n, i) => {
    const y = H * 0.2 + i * ((H * 0.64) / Math.max(1, notes.length));
    g.save();
    g.translate(W * 0.13, y);
    g.rotate((rand() - 0.5) * 0.07);
    g.beginPath();
    g.arc(-size * 0.55, -size * 0.3, size * 0.12, 0, Math.PI * 2);
    g.fill();
    wrap(g, n, W * 0.74, size * 1.15);
    g.restore();
  });
  return new CanvasTexture(c);
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  let y = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, 0, y);
      line = w;
      y += lh;
    } else line = test;
  }
  g.fillText(line, 0, y);
}
