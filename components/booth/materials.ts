'use client';

import {
  CanvasTexture, Color, DoubleSide, FrontSide, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace,
  type Material, type Mesh, type Object3D, type WebGLProgramParametersWithUniforms,
} from 'three';
import { kick } from './activity';

/**
 * Materials for the booth objects. One set of shared uniforms drives every object, so a lamp change
 * or a hover is a uniform write, never a shader recompile:
 *   uUV      UV lamp level: white stock fluoresces violet-white (optical brighteners), in
 *            proportion to how white the surface is
 *   uHover   per material: a soft rim from the hover light
 */
export const shared = {
  uUV: { value: 0 },
  uFluor: { value: new Color(0.62, 0.52, 1.0) },
};

type Patched = Material & { userData: { hover?: { value: number }; dim?: { value: number }; booth?: boolean } };

/** Adds fluorescence and the hover rim to a lit material (idempotent). */
export function patch(m: Material, fluor = 1) {
  const pm = m as Patched;
  if (pm.userData.booth) return;
  pm.userData.booth = true;
  const hover = { value: 0 };
  const dim = { value: 0 };
  pm.userData.hover = hover;
  pm.userData.dim = dim;
  const fl = { value: fluor };
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uUV = shared.uUV;
    shader.uniforms.uFluorColor = shared.uFluor;
    shader.uniforms.uHover = hover;
    shader.uniforms.uDim = dim;
    shader.uniforms.uFluorAmt = fl;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uUV;\nuniform vec3 uFluorColor;\nuniform float uHover;\nuniform float uDim;\nuniform float uFluorAmt;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          float sat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
          float white = smoothstep(0.45, 0.9, lum) * (1.0 - smoothstep(0.08, 0.35, sat));
          totalEmissiveRadiance += uUV * uFluorAmt * white * uFluorColor * 0.9;
        }`,
      )
      .replace(
        '#include <output_fragment>',
        `{
          float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
          outgoingLight += uHover * rim * 0.18 * (1.0 - uUV);
          outgoingLight *= 1.0 - uDim;
        }
        #include <output_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'booth-v1';
}

export function setHover(root: Object3D, v: number, dimV = 0) {
  root.traverse((o) => {
    const m = (o as Mesh).material as Patched | Patched[] | undefined;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) {
      if (x.userData.hover) x.userData.hover.value = v;
      if (x.userData.dim) x.userData.dim.value = dimV;
    }
  });
}

/** Glass without a transmission pass: a clear, glossy coat that shows the environment. */
function glass(src: MeshStandardMaterial) {
  const g = new MeshPhysicalMaterial({
    color: src.color?.clone() ?? new Color(1, 1, 1),
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.6,
    side: DoubleSide,
  });
  g.name = src.name;
  return g;
}

/**
 * Fix up a loaded GLB for the booth: every part casts and receives shadow; closed solids draw one
 * side; glass becomes a cheap clear coat; paper and card stay matte; device screens get the brand
 * screen (see `screenMaterial`).
 */
export function prepareModel(root: Object3D, opts: { slug: string; frontSide?: boolean }) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const fix = (m: Material): Material => {
      const sm = m as MeshStandardMaterial;
      const name = (m.name || '').toUpperCase();
      if (/GLASS/.test(name) && !/TRACKPAD/.test(name)) return glass(sm);
      if ((m as MeshPhysicalMaterial).transmission) return glass(sm);
      if (sm.isMeshStandardMaterial) {
        // single-sided solids: no self-shadow acne from the back faces, half the fragments
        if (opts.frontSide || /SCREEN|ALU|BEZEL|KEYS|RUBBER|TABLET|PHONE|STAND|EASEL|BOX|TIN|JAR|CARTON|SET|TUG|WHEELS|TOWBAR/.test(name)) sm.side = FrontSide;
        sm.shadowSide = FrontSide;
        if (sm.map) sm.map.anisotropy = 8;
        sm.envMapIntensity = 1;
        if (sm.transparent && sm.alphaTest === 0 && sm.opacity >= 1) sm.depthWrite = true;
        patch(sm);
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
  });
}

/* ── Device screens: the brand logo on its own colour, emissive under a glass coat ───────────── */

export type Screen = { material: MeshPhysicalMaterial; colour: Color };
export const screens = new Map<string, Screen>();
const brandBg = new Map<string, string>();

async function brand(slug: string) {
  const res = await fetch(`/brand/${slug}/bg.txt`).catch(() => null);
  if (!res?.ok) return null;
  const bg = (await res.text()).trim();
  const logo = new Image();
  logo.decoding = 'async';
  logo.src = `/brand/${slug}/logo.svg`;
  await logo.decode().catch(() => null);
  return { bg, logo };
}

export function screenMaterial(slug: string, aspect: number): Screen {
  const hit = screens.get(slug);
  if (hit) return hit;
  const W = aspect >= 1 ? 1024 : Math.round(1024 * aspect);
  const H = Math.round(W / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#060607';
  g.fillRect(0, 0, W, H);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.flipY = false;
  const colour = new Color(0.05, 0.05, 0.06);
  const material = new MeshPhysicalMaterial({
    color: '#020203',
    roughness: 0.5,
    metalness: 0,
    emissive: '#ffffff',
    emissiveMap: texture,
    emissiveIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  patch(material, 0);
  const s = { material, colour };
  screens.set(slug, s);
  void brand(slug).then((b) => {
    if (!b) return;
    brandBg.set(slug, b.bg);
    g.fillStyle = b.bg;
    g.fillRect(0, 0, W, H);
    const la = b.logo.naturalWidth / Math.max(1, b.logo.naturalHeight) || 1;
    const box = Math.min(W, H) * 0.46;
    const lw = la >= 1 ? Math.min(W * 0.62, box * la) : box * la;
    g.drawImage(b.logo, (W - lw) / 2, (H - lw / la) / 2, lw, lw / la);
    colour.set(b.bg);
    texture.needsUpdate = true;
    kick(50);
  });
  return s;
}
