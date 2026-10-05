import { CanvasTexture, Color, DataTexture, Matrix3, Matrix4, Vector4, type Material, type Texture } from 'three';

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
  uFluorGain: { value: 0.7 },
  uInkGain: { value: 1.05 },
};

export type InkProjection = {
  map: Texture;
  /** Rectangle the ink covers, in the projection space (x, y): [x0, y0, x1, y1]. */
  box: [number, number, number, number];
  /**
   * Mesh-local → projection space. Placeholders print in their own local space (identity); a GLB's
   * meshes sit under node transforms, so each gets the matrix into the object's root space.
   */
  space?: Matrix4;
};

export type UVOptions = {
  fluor?: number;
  /**
   * GLB materials without an authored fluorMask: paper whites fluoresce in proportion to how white
   * they are (optical brighteners live in white stock, not in the inks printed on it).
   */
  fluorFromBase?: boolean;
  fluorMask?: Texture | null;
  uvInk?: Texture | null;
  inkProj?: InkProjection | null;
};

export function applyUV(material: Material, opts: UVOptions = {}) {
  const hasMask = !!opts.fluorMask;
  const hasInk = !!opts.uvInk;
  const hasProj = !!opts.inkProj;
  const fromBase = !!opts.fluorFromBase;
  const lit = material.type !== 'MeshBasicMaterial';
  const local = {
    /** Hover: a soft rim highlight, 0–1 (set by the slot). */
    uHover: { value: 0 },
    uFluor: { value: opts.fluor ?? (hasMask || opts.fluorFromBase ? 1 : 0) },
    uFluorMask: { value: opts.fluorMask ?? null },
    uUvInk: { value: opts.uvInk ?? null },
    uInkProj: { value: opts.inkProj?.map ?? null },
    uInkBox: { value: new Vector4(...(opts.inkProj?.box ?? [0, 0, 1, 1])) },
    uInkSpace: { value: opts.inkProj?.space ?? new Matrix4() },
    uInkSpaceN: { value: new Matrix3().getNormalMatrix(opts.inkProj?.space ?? new Matrix4()) },
  };
  material.userData.uv = local;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uvUniforms, local);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBoothUv;\nvarying vec3 vBoothPos;\nvarying vec3 vBoothNormal;\nuniform mat4 uInkSpace;\nuniform mat3 uInkSpaceN;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBoothUv = uv;\nvBoothPos = (uInkSpace * vec4(position, 1.0)).xyz;\nvBoothNormal = uInkSpaceN * normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vBoothUv; varying vec3 vBoothPos; varying vec3 vBoothNormal;
        uniform float uUV, uFluor, uFluorGain, uInkGain, uHover;
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
          vec3 fluorTint = ${hasMask ? 'texture2D(uFluorMask, vBoothUv).rgb' : fromBase ? 'vec3(smoothstep(0.72, 0.95, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))))' : 'vec3(1.0)'};
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
          ${lit ? `{
            // hover: a soft fresnel rim, neutral, a few percent (the object "catches" the light)
            float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
            outgoingLight += uHover * rim * 0.22 * vec3(1.0);
          }` : ''}
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `booth-uv-${hasMask}-${hasInk}-${hasProj}-${fromBase}-${lit}`;
  material.needsUpdate = true;
}

/** The site's mono (Geist Mono via next/font), read from its CSS variable so canvas text matches the page. */
function monoFamily() {
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() : '';
  return v || 'ui-monospace, monospace';
}

/**
 * A work's uvNotes as a proofer's hidden marks, the way a pre-press checker
 * writes on a proof: thin rules, a dimension line with end ticks, a centre
 * cross, and short callouts (dot + leader + small mono label). No boxes, no
 * script fonts: it should read as technical-pen ink on the object.
 */
let blank: DataTexture | null = null;
/** Black ink: contributes nothing under UV. Used until a project's notes are approved. */
export function blankInk(): Texture {
  if (!blank) {
    blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blank.needsUpdate = true;
  }
  return blank;
}

export function createInkTexture(notes: string[], aspect: number, seed = 1) {
  const W = 1024;
  const H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const tex = new CanvasTexture(c);
  const draw = () => {
    const g = c.getContext('2d', { willReadFrequently: true })!;
    let r = seed * 9301;
    const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const mono = monoFamily();
    const u = Math.min(W, H) / 100; // 1% of the short side
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineCap = 'butt';

    // dimension line across the top, with end ticks (never a number: only approved notes carry figures)
    const y0 = H * 0.08;
    g.lineWidth = Math.max(1.5, u * 0.22);
    g.beginPath();
    g.moveTo(W * 0.08, y0);
    g.lineTo(W * 0.92, y0);
    for (const x of [W * 0.08, W * 0.92]) {
      g.moveTo(x, y0 - u * 1.6);
      g.lineTo(x, y0 + u * 1.6);
    }
    g.stroke();
    const label = (t: string, x: number, y: number, size: number, align: CanvasTextAlign = 'left') => {
      g.font = `500 ${size}px ${mono}`;
      g.textAlign = align;
      g.textBaseline = 'middle';
      const pad = size * 0.35;
      const w = g.measureText(t).width;
      const lx = align === 'center' ? x - w / 2 : x;
      g.fillStyle = '#000';
      g.fillRect(lx - pad, y - size * 0.6, w + pad * 2, size * 1.2);
      g.fillStyle = '#fff';
      g.fillText(t, x, y);
    };
    const small = Math.max(16, Math.min(30, u * 3.4));

    // centre cross + a faint baseline rule at the lower third
    g.lineWidth = Math.max(1, u * 0.15);
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(W / 2 - u * 3, H / 2);
    g.lineTo(W / 2 + u * 3, H / 2);
    g.moveTo(W / 2, H / 2 - u * 3);
    g.lineTo(W / 2, H / 2 + u * 3);
    g.setLineDash([u * 1.2, u * 1.2]);
    g.moveTo(W * 0.06, H * 0.67);
    g.lineTo(W * 0.94, H * 0.67);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    // callouts: a dot on the object, a leader, a short uppercase mono label
    const n = Math.max(1, notes.length);
    notes.forEach((note, i) => {
      const ty = H * (0.22 + (0.62 * (i + 0.5)) / n);
      const left = i % 2 === 0;
      const px = W * (left ? 0.3 + rand() * 0.12 : 0.58 + rand() * 0.12);
      const py = ty + (rand() - 0.5) * H * 0.05;
      const lx = left ? W * 0.07 : W * 0.93;
      g.lineWidth = Math.max(1.5, u * 0.2);
      g.beginPath();
      g.arc(px, py, u * 0.7, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(left ? px - W * 0.06 : px + W * 0.06, ty);
      g.lineTo(lx + (left ? W * 0.01 : -W * 0.01), ty);
      g.stroke();
      const text = note.toUpperCase();
      const size = Math.max(14, Math.min(26, (W * 0.42) / Math.max(12, text.length * 0.62)));
      label(text.length > 46 ? text.slice(0, 44) + '…' : text, left ? lx : lx, ty - size * 0.95, size, left ? 'left' : 'right');
    });
    tex.needsUpdate = true;
  };
  draw();
  // redraw once the mono webfont is ready, so the marks use the site's typeface
  if (typeof document !== 'undefined' && document.fonts) void document.fonts.ready.then(draw);
  return tex;
}

/**
 * Approved notes as invisible ink on a proof photograph: each note is a dot at its position, a
 * short leader and a mono caps label, white on black (the shader adds it as cyan glow under UV).
 */
export function createProofInk(notes: { text: string; at: [number, number] }[], aspect: number) {
  const W = 1600;
  const H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const tex = new CanvasTexture(c);
  const draw = () => {
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const mono = monoFamily();
    const u = Math.min(W, H) / 100;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = g.fillStyle = '#fff';
    g.lineWidth = Math.max(1.5, u * 0.18);
    // registration marks in the corners, as a proofer would
    for (const [x, y] of [[0.04, 0.06], [0.96, 0.06], [0.04, 0.94], [0.96, 0.94]]) {
      g.beginPath();
      g.arc(W * x, H * y, u * 1.2, 0, Math.PI * 2);
      g.moveTo(W * x - u * 2, H * y);
      g.lineTo(W * x + u * 2, H * y);
      g.moveTo(W * x, H * y - u * 2);
      g.lineTo(W * x, H * y + u * 2);
      g.stroke();
    }
    const size = Math.max(18, Math.min(34, u * 3));
    g.font = `500 ${size}px ${mono}`;
    g.textBaseline = 'middle';
    for (const n of notes) {
      const px = n.at[0] * W, py = n.at[1] * H;
      const right = n.at[0] < 0.5;
      const lx = px + (right ? 1 : -1) * W * 0.05;
      g.beginPath();
      g.arc(px, py, u * 0.6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(lx, py - size);
      g.stroke();
      g.textAlign = right ? 'left' : 'right';
      const w = g.measureText(n.text).width;
      const pad = size * 0.35;
      g.fillStyle = '#000';
      g.fillRect(right ? lx - pad : lx - w - pad, py - size * 1.6, w + pad * 2, size * 1.2);
      g.fillStyle = '#fff';
      g.fillText(n.text, lx, py - size);
    }
    tex.needsUpdate = true;
  };
  draw();
  if (typeof document !== 'undefined' && document.fonts) void document.fonts.ready.then(draw);
  return tex;
}
