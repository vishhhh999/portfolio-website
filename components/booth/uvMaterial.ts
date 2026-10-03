import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  ShaderMaterial,
  type MeshStandardMaterial,
  type Texture,
} from 'three';

/**
 * UV (blacklight) material system. One set of shared uniforms drives every
 * material in the booth, so a lamp change is one uniform write, not a traversal.
 *
 * Two texture slots per material, authored in Blender for real assets (Phase 4):
 *   fluorMask  RGB: where and in what tint the surface fluoresces (paper OBAs, fluorescent inks)
 *   uvInk      R:   the proofer's hidden annotation layer (black = nothing, white = ink)
 * Placeholders without a mask use a constant `fluor` amount instead.
 */
export const uvUniforms = {
  uUV: { value: 0 },
  /** Violet-white: optical brighteners in paper under UV-A. */
  uFluorColor: { value: new Color(0.62, 0.52, 1.0) },
  /** Cyan-white: the invisible-ink annotation layer. */
  uInkColor: { value: new Color(0.55, 1.0, 0.95) },
  uFluorGain: { value: 2.2 },
  uInkGain: { value: 3.2 },
};

export type UVOptions = { fluor?: number; fluorMask?: Texture | null; uvInk?: Texture | null };

export function applyUV(material: MeshStandardMaterial, opts: UVOptions = {}) {
  const hasMask = !!opts.fluorMask;
  const hasInk = !!opts.uvInk;
  const local = {
    uFluor: { value: opts.fluor ?? (hasMask ? 1 : 0) },
    uFluorMask: { value: opts.fluorMask ?? null },
    uUvInk: { value: opts.uvInk ?? null },
  };
  material.userData.uv = local;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uvUniforms, local);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBoothUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBoothUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vBoothUv;
        uniform float uUV, uFluor, uFluorGain, uInkGain;
        uniform vec3 uFluorColor, uInkColor;
        ${hasMask ? 'uniform sampler2D uFluorMask;' : ''}
        ${hasInk ? 'uniform sampler2D uUvInk;' : ''}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 fluorTint = ${hasMask ? 'texture2D(uFluorMask, vBoothUv).rgb' : 'vec3(1.0)'};
          totalEmissiveRadiance += uUV * uFluor * uFluorGain * uFluorColor * fluorTint;
          ${hasInk ? 'totalEmissiveRadiance += uUV * uInkGain * uInkColor * texture2D(uUvInk, vBoothUv).r;' : ''}
        }`,
      );
  };
  material.customProgramCacheKey = () => `booth-uv-${hasMask}-${hasInk}`;
  material.needsUpdate = true;
}

/**
 * Additive ink decal for placeholders (their UV layouts aren't authored).
 * Invisible under every lamp except UV; same uniforms as the material chunk.
 */
export function createInkDecalMaterial(ink: Texture) {
  return new ShaderMaterial({
    uniforms: { ...uvUniforms, uUvInk: { value: ink } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uUV, uInkGain; uniform vec3 uInkColor; uniform sampler2D uUvInk; varying vec2 vUv;
      void main() { gl_FragColor = vec4(uInkColor * uInkGain * uUV * texture2D(uUvInk, vUv).r, 1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** Draws a work's uvNotes as a proofer's hidden-mark layer: grid + handwritten-style notes. */
export function createInkTexture(notes: string[], aspect: number, seed = 1) {
  const W = 1024;
  const H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // construction grid
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  const step = W / 12;
  for (let x = step; x < W; x += step) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = step; y < H; y += step) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  // margins
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 4;
  g.strokeRect(W * 0.06, H * 0.06, W * 0.88, H * 0.88);
  // notes
  let r = seed * 9301;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const size = Math.max(30, Math.min(56, H / (notes.length * 2.6)));
  g.fillStyle = '#fff';
  g.font = `italic 500 ${size}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive, sans-serif`;
  notes.forEach((n, i) => {
    const y = H * 0.18 + i * ((H * 0.7) / Math.max(1, notes.length));
    g.save();
    g.translate(W * 0.1, y);
    g.rotate((rand() - 0.5) * 0.06);
    wrap(g, n, W * 0.8, size * 1.1);
    g.restore();
  });
  const t = new CanvasTexture(c);
  t.anisotropy = 4;
  return t;
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
