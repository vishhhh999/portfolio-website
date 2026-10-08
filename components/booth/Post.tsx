'use client';

import { perfOff } from '@/lib/perfFlags';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  Pass,
  ShaderPass,
  NormalPass,
  SMAAEffect,
  SSAOEffect,
} from 'postprocessing';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  RedFormat,
  RepeatWrapping,
  Material,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  NoToneMapping,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Uniform,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { frameRect, stageRect, viewportSize, withViewSnapshot, type ViewSnapshot } from '@/lib/views';
import { isMobileTier } from '@/lib/perfTier';
import { loupeState } from '@/lib/loupe';
import { useBooth } from '@/lib/store';
import { isDirty, markDirty, takeDirty } from '@/lib/dirty';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { hoverFocus } from './focus';
import { roomLightmap } from './BoothRoom';
import { activeLayout, STAGING } from './staging';
import { logEvent } from '@/lib/eventLog';

declare global {
  interface Window {
    /** tools/check-flicker.mjs: when on, every presented frame's mean stage luminance is recorded. */
    __boothCapture?: { on: boolean; lums: number[]; visibleContent?: boolean };
  }
}

/** Written by the lamp rig every frame, read here. */
export const postState = {
  bloomIntensity: 0,
  bloomThreshold: 1,
  grain: 0,
  /** Booth exposure into AgX (per lamp, set by the rig). */
  exposure: 1,
  /** B5: the room lamps tone-map with Khronos PBR Neutral (paper whites separate from N8 walls); the dark lamps keep AgX. */
  neutral: true,
  matrix: new Matrix3(),
  /** Set by the rig to request a one-off console report after the next frame. */
  diagnose: null as null | Record<string, unknown>,
};

/** ?tone=agx|neutral: force one tone map (calibration only). */
const TONE_OVERRIDE = typeof window === 'undefined' ? null : ({ agx: 0, neutral: 1 } as Record<string, number>)[new URLSearchParams(window.location.search).get('tone') ?? ''] ?? null;
/** ?exposure=0.6: multiply every lamp's exposure (calibration only). */
const EXPOSURE_OVERRIDE = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('exposure') ?? 1) || 1 : 1;
const VIEW_DEBUG = typeof window !== 'undefined' && window.location.search.includes('viewdebug');
/** ?perf: profiling and test hooks (the only paths besides the held loupe that read pixels back). */
const PERF = typeof window !== 'undefined' && window.location.search.includes('perf');
let debugScene: Scene | null = null;
const MAGENTA = new MeshBasicMaterial({ color: 0xff00ff, toneMapped: false });
/** The booth's opaque geometry in flat magenta (transparent layers such as the page shadow left out). */
function renderSilhouette(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const hidden: Object3D[] = [];
  scene.traverse((o) => {
    const m = (o as Mesh).material as Material | undefined;
    if (o.visible && m && !Array.isArray(m) && m.transparent) {
      o.visible = false;
      hidden.push(o);
    }
  });
  scene.overrideMaterial = MAGENTA;
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  for (const o of hidden) o.visible = true;
}

/** A full-viewport magenta quad (whatever viewport is set: here, the stage rect). */
function debugQuad() {
  if (!debugScene) {
    debugScene = new Scene();
    const m = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); }',
        depthTest: false,
        depthWrite: false,
      }),
    );
    m.frustumCulled = false;
    debugScene.add(m);
  }
  return debugScene;
}

/** Rendered once per frame, only to resolve the MSAA buffer (in full, or the stage's rect: H2). */
const EMPTY = new Scene();
const resolveState = { key: '', fullLeft: 2 };

/** The booth's scissor in buffer px this frame (the normal pass for SSAO uses the same). */
const boothScissor = new Vector4();

/** Lets the perf probe resize the composer in the same task as a DPR step. */
export const postApi = { resize: () => {}, snapshot: () => false, samples: 0 };


/**
 * Renders every view into the composer's input buffer: the booth scene
 * scissored into the stage rect (with its own aspect), then the proof-strip
 * planes in screen space. Everything else stays transparent.
 */
class ViewsPass extends Pass {
  constructor(private booth: Scene, private boothCamera: Camera) {
    super('ViewsPass');
    this.needsSwap = false;
  }
  render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    const dpr = renderer.getPixelRatio();
    const H = inputBuffer.height;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(inputBuffer);
    inputBuffer.viewport.set(0, 0, inputBuffer.width, H);
    inputBuffer.scissorTest = false;
    renderer.setRenderTarget(inputBuffer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);

    const s = stageRect();
    if (s && s.top < window.innerHeight && s.top + s.height > 0) {
      // the booth camera's projection spans the whole buffer; the stage rect is a scissor
      const x = Math.round(s.left * dpr);
      const w = Math.round(s.width * dpr);
      const h = Math.round(s.height * dpr);
      const y = Math.round(H - (s.top + s.height) * dpr);
      inputBuffer.scissor.set(x, Math.max(0, y), w, Math.min(h, H - Math.max(0, y)));
      inputBuffer.scissorTest = true;
      renderer.setRenderTarget(inputBuffer);
      if (VIEW_DEBUG) {
        // ?viewdebug: the stage rect as a solid colour, and ?viewdebug=cabinet the booth's opaque silhouette,
        // so tools/check-views.mjs can compare what is drawn with the DOM rects
        renderer.clear(true, true, false);
        if (window.location.search.includes('viewdebug=cabinet')) renderSilhouette(renderer, this.booth, this.boothCamera);
        else renderer.render(debugQuad(), this.boothCamera);
      } else {
        renderer.clear(true, true, false); // scene background fills the stage only
        renderer.render(this.booth, this.boothCamera);
      }
      boothScissor.set(x, Math.max(0, y), w, Math.min(h, H - Math.max(0, y)));
      inputBuffer.scissorTest = false;
      renderer.setRenderTarget(inputBuffer);
    } else boothScissor.set(0, 0, 0, 0);

    // A1: with MSAA, three resolves the multisampled buffer into its texture only at the end of a
    // render() call, and the resolve (a blit) obeys the scissor that was active. The booth renders
    // with the stage scissor, and a frame with nothing on screen only clears, so everywhere outside
    // the current stage the texture kept old frames: trails as the stage moved, and old views
    // (the home cabinet, proofs at old positions) under the page. One empty render with the
    // scissor off resolves the whole buffer, every frame.
    // H2: the full, unscissored copy is only needed while old content could survive outside the
    // current view: for two frames after the stage rect changed (moved, resized, appeared, left).
    // Otherwise only the stage's own rect is copied (nothing else was drawn this frame).
    const key = `${boothScissor.x},${boothScissor.y},${boothScissor.z},${boothScissor.w},${inputBuffer.width},${inputBuffer.height}`;
    if (key !== resolveState.key) {
      resolveState.key = key;
      resolveState.fullLeft = 2;
    }
    if (resolveState.fullLeft > 0) {
      resolveState.fullLeft--;
      inputBuffer.scissorTest = false;
      renderer.setRenderTarget(inputBuffer);
      renderer.render(EMPTY, this.boothCamera);
    } else if (boothScissor.z > 0) {
      inputBuffer.scissor.copy(boothScissor);
      inputBuffer.scissorTest = true;
      renderer.setRenderTarget(inputBuffer);
      renderer.render(EMPTY, this.boothCamera);
      inputBuffer.scissorTest = false;
      renderer.setRenderTarget(inputBuffer);
    }
    renderer.autoClear = autoClear;
  }
}

/**
 * Normals + depth of the booth for SSAO (desktop), at half resolution, limited to the booth's
 * scissor. Everything outside is cleared to "nothing here" every frame, so no stale normals are
 * ever read outside the stage (the stage moves as the page scrolls).
 */
class BoothNormalPass extends NormalPass {
  render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null, outputBuffer: WebGLRenderTarget | null, deltaTime?: number, stencilTest?: boolean) {
    // B3 (08): normals and depth change only with the camera or the objects: otherwise reuse them
    if (!takeDirty('normals')) return;
    const rt = (this as unknown as { renderTarget: WebGLRenderTarget }).renderTarget;
    rt.scissorTest = false;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x7777ff, 1);
    renderer.clear(true, true, false);
    renderer.setClearColor(0x000000, 0);
    if (boothScissor.z <= 0 || !inputBuffer) return;
    const k = rt.width / inputBuffer.width;
    rt.scissor.set(Math.floor(boothScissor.x * k), Math.floor(boothScissor.y * k), Math.ceil(boothScissor.z * k), Math.ceil(boothScissor.w * k));
    rt.scissorTest = true;
    // B3 (08): with a baked room lightmap the room already has its occlusion: SSAO sees the objects only
    const hidden: Object3D[] = [];
    if (roomLightmap.on) {
      (this as unknown as { renderPass: { scene: Object3D } }).renderPass.scene.traverse((o) => {
        if (o.userData.room && o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      });
    }
    super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    for (const o of hidden) o.visible = true;
    rt.scissorTest = false;
  }
}

/**
 * Copies the views' coverage (alpha, straight after they render) into its own
 * texture. Bloom and grain blend alpha with max(), so the mask can't trust the
 * final alpha; this is the true silhouette of the cabinet, its shadow on the
 * page, and the photo planes.
 */
class CoveragePass extends Pass {
  readonly target = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  constructor() {
    super('CoveragePass');
    this.needsSwap = false;
    this.fullscreenMaterial = new ShaderMaterial({
      uniforms: { inputBuffer: { value: null } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform sampler2D inputBuffer; varying vec2 vUv;
        void main() { float a = texture2D(inputBuffer, vUv).a; gl_FragColor = vec4(isnan(a) ? 0.0 : clamp(a, 0.0, 1.0)); }`,
      depthTest: false,
      depthWrite: false,
    });
  }
  render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    (this.fullscreenMaterial as ShaderMaterial).uniforms.inputBuffer.value = inputBuffer.texture;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
  }
  setSize(width: number, height: number) {
    this.target.setSize(width, height);
  }
}

/**
 * 3×3 colour matrix in linear light, applied before tone mapping. Spectral
 * character only (a fluorescent's narrow bands, tungsten's missing blue).
 */
class ColorMatrixEffect extends Effect {
  constructor() {
    super(
      'ColorMatrixEffect',
      /* glsl */ `
      uniform mat3 matrix;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(max(matrix * inputColor.rgb, 0.0), inputColor.a);
      }`,
      { uniforms: new Map([['matrix', new Uniform(new Matrix3())]]) },
    );
  }
}

/**
 * Tone mapping for the booth only: AgX (Blender / Filament's, as in three.js) with an exposure the
 * lamp rig sets (calibrated so the D50 grey card reads 18% grey). Outside the booth stage the
 * pixels are proof-strip photographs, which are display-referred already: they pass through
 * untouched (clamped), so a relit photo at D50 level 1 is the file, with no tone curve to undo.
 */
class BoothToneEffect extends Effect {
  constructor() {
    super(
      'BoothToneEffect',
      /* glsl */ `
      uniform float exposure;
      uniform float neutral;
      uniform vec4 box;
      uniform vec4 vbox;
      const mat3 SRGB_TO_2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
      const mat3 REC2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
      const mat3 INSET = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
      const mat3 OUTSET = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
      vec3 contrast(vec3 x) {
        vec3 x2 = x * x; vec3 x4 = x2 * x2;
        return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      }
      vec3 agx(vec3 c) {
        c = INSET * (SRGB_TO_2020 * c);
        c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
        c = OUTSET * contrast(c);
        c = pow(max(c, 0.0), vec3(2.2));
        return clamp(REC2020_TO_SRGB * c, 0.0, 1.0);
      }
      // Khronos PBR Neutral: linear to 0.76, then a soft shoulder; hue and base colours kept
      vec3 pbrNeutral(vec3 c) {
        float x = min(c.r, min(c.g, c.b));
        float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
        c -= offset;
        float peak = max(c.r, max(c.g, c.b));
        if (peak < 0.76) return c;
        float d = 0.24;
        float newPeak = 1.0 - d * d / (peak + d - 0.76);
        c *= newPeak / peak;
        float g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
        return mix(c, vec3(newPeak), g);
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        bool inside = uv.x >= box.x && uv.x <= box.z && uv.y >= box.y && uv.y <= box.w;
        vec3 e = inputColor.rgb * exposure;
        vec3 c = inside ? (neutral > 0.5 ? clamp(pbrNeutral(e), 0.0, 1.0) : agx(e)) : clamp(inputColor.rgb, 0.0, 1.0);
        // J4: a gentle vignette inside the stage (the corners ~10% down), never on the page
        if (inside) {
          vec2 q = (uv - vbox.xy) / max(vbox.zw - vbox.xy, vec2(1e-4)) - 0.5;
          c *= 1.0 - 0.1 * smoothstep(0.3, 0.72, length(q * vec2(1.0, 0.86)));
        }
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map<string, Uniform>([
          ['exposure', new Uniform(1)],
          ['neutral', new Uniform(1)],
          ['box', new Uniform(new Vector4(0, 0, 0, 0))],
          ['vbox', new Uniform(new Vector4(0, 0, 0, 0))],
        ]),
      },
    );
  }
  update() {
    (this.uniforms.get('exposure') as Uniform<number>).value = postState.exposure * EXPOSURE_OVERRIDE;
    (this.uniforms.get('neutral') as Uniform<number>).value = TONE_OVERRIDE ?? (postState.neutral ? 1 : 0);
    setStageBox(this.uniforms.get('box')!.value as Vector4);
    setVignetteBox(this.uniforms.get('vbox')!.value as Vector4);
  }
}

/**
 * D (08): the masked focus. Depth of field cannot isolate one sample (they all sit at nearly the
 * same distance), so the focus is a mask instead: the focused sample's own meshes are drawn into a
 * half-resolution mask (each sample by its weight, so moving between samples crossfades), and
 * everything outside the feathered mask (~6px at 1440p) is softened by at most 2.5px at 1440p.
 * Strength ramps 0 → 1 over 250ms on hover, back over 300ms; the tray object is the focus at rest
 * on project pages (0.6). In the chain from the start; at strength 0 it costs nothing (no taps).
 * Off on the mobile tier and under reduced motion.
 */
export const focusState = { strength: 0, weights: new Map<string, number>() };
class BoothFocusEffect extends Effect {
  constructor(mask: Texture) {
    super(
      'BoothFocusEffect',
      /* glsl */ `
      uniform sampler2D maskMap;
      uniform float strength;
      uniform float radius;
      uniform float feather;
      uniform vec4 box;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        bool inside = uv.x >= box.x && uv.x <= box.z && uv.y >= box.y && uv.y <= box.w;
        if (!inside || strength < 0.003) { outputColor = inputColor; return; }
        // the feathered mask (weights normalised by the strength: a focused sample is fully sharp)
        float m = texture2D(maskMap, uv).r * 2.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398;
          m += texture2D(maskMap, uv + vec2(cos(a), sin(a)) * feather * texelSize).r;
        }
        m = clamp(m / 10.0 / strength, 0.0, 1.0);
        float k = strength * (1.0 - m);
        if (k < 0.01) { outputColor = inputColor; return; }
        vec4 acc = inputColor;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt((float(i) + 0.5) / 12.0) * radius * k;
          acc += texture2D(inputBuffer, uv + vec2(cos(a), sin(a)) * r * texelSize);
        }
        outputColor = acc / 13.0;
      }`,
      {
        uniforms: new Map<string, Uniform>([
          ['maskMap', new Uniform(mask)],
          ['strength', new Uniform(0)],
          ['radius', new Uniform(2.5)],
          ['feather', new Uniform(6)],
          ['box', new Uniform(new Vector4(0, 0, 0, 0))],
        ]),
      },
    );
  }
  setScale(bufferHeight: number) {
    // 2.5px blur and a 6px feather at 1440p, in buffer pixels
    (this.uniforms.get('radius') as Uniform<number>).value = (2.5 * bufferHeight) / 1440;
    (this.uniforms.get('feather') as Uniform<number>).value = (6 * bufferHeight) / 1440;
  }
  update() {
    (this.uniforms.get('strength') as Uniform<number>).value = focusState.strength;
    setStageBox(this.uniforms.get('box')!.value as Vector4);
  }
}

/** The booth stage in uv space (x0, y0, x1, y1); empty when there is no stage. */
/**
 * L6 (09B): the vignette's box: the cabinet's own frame on home (so the picture is the same at every
 * window size, whatever the stage's proportions), the stage everywhere else.
 */
function setVignetteBox(box: Vector4) {
  const f = activeLayout().kind === 'cabinet' && !useBooth.getState().activeSlug ? frameRect() : null;
  if (!f) return setStageBox(box);
  const { width: W, height: H } = viewportSize();
  return box.set(f.left / W, 1 - (f.top + f.height) / H, (f.left + f.width) / W, 1 - f.top / H);
}
function setStageBox(box: Vector4) {
  const r = stageRect();
  if (!r) return box.set(0, 0, 0, 0);
  const { width: W, height: H } = viewportSize();
  return box.set(r.left / W, 1 - (r.top + r.height) / H, (r.left + r.width) / W, 1 - r.top / H);
}

/**
 * Last effect: every pixel takes the views' true coverage as alpha (premultiplied),
 * so the cabinet sits on the page with its soft shadow and the photos are cut
 * cleanly, while the page itself (paper) is never touched by any lamp or effect.
 */
class ViewMaskEffect extends Effect {
  constructor(coverage: WebGLRenderTarget) {
    super(
      'ViewMaskEffect',
      /* glsl */ `
      uniform sampler2D coverageMap;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float a = texture2D(coverageMap, uv).r;
        outputColor = vec4(inputColor.rgb * a, a);
      }`,
      { uniforms: new Map<string, Uniform>([['coverageMap', new Uniform(coverage.texture)]]) },
    );
  }
}

/**
 * Film grain from a precomputed tiling noise texture (no per-pixel hashing): one 256² tile,
 * offset each frame so the grain moves. Same look as before: premultiplied, soft-light blended.
 */
function grainTexture() {
  const N = 256;
  const data = new Uint8Array(N * N);
  let s = 1234567;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s >> 16) & 0xff;
  }
  const t = new DataTexture(data, N, N, RedFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

class GrainEffect extends Effect {
  constructor() {
    super(
      'GrainEffect',
      /* glsl */ `
      uniform sampler2D grainMap;
      uniform vec2 grainScale;
      uniform vec2 grainOffset;
      uniform vec4 grainBox; // the booth stage in uv (x0, y0, x1, y1): grain never touches proof images
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float n = texture2D(grainMap, uv * grainScale + grainOffset).r;
        float inside = step(grainBox.x, uv.x) * step(uv.x, grainBox.z) * step(grainBox.y, uv.y) * step(uv.y, grainBox.w);
        n = mix(0.5, n, inside); // 0.5 is neutral under soft light
        outputColor = vec4(inputColor.rgb * n, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SOFT_LIGHT,
        uniforms: new Map<string, Uniform>([
          ['grainMap', new Uniform(grainTexture())],
          ['grainScale', new Uniform(new Vector2(1, 1))],
          ['grainOffset', new Uniform(new Vector2())],
          ['grainBox', new Uniform(new Vector4(0, 0, 0, 0))],
        ]),
      },
    );
  }
  setSize(width: number, height: number) {
    // one texel per output pixel
    (this.uniforms.get('grainScale')!.value as Vector2).set(width / 256, height / 256);
  }
  update() {
    (this.uniforms.get('grainOffset')!.value as Vector2).set(Math.random(), Math.random());
    setStageBox(this.uniforms.get('grainBox')!.value as Vector4);
  }
}

/**
 * Scrubs NaN / Inf and clamps runaway HDR values before bloom. A single bad
 * pixel (a GPU-specific shader edge case) otherwise spreads through the bloom
 * mip chain and turns the entire frame black.
 */
function sanitizeMaterial() {
  return new ShaderMaterial({
    uniforms: { inputBuffer: { value: null } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D inputBuffer; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(inputBuffer, vUv);
        bvec4 bad = bvec4(isnan(c.r) || isinf(c.r), isnan(c.g) || isinf(c.g), isnan(c.b) || isinf(c.b), isnan(c.a) || isinf(c.a));
        c = vec4(bad.x ? 0.0 : c.r, bad.y ? 0.0 : c.g, bad.z ? 0.0 : c.b, bad.w ? 1.0 : c.a);
        gl_FragColor = vec4(clamp(c.rgb, 0.0, 64.0), c.a);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * The single post chain over the whole frame (booth + photos): views →
 * sanitize → bloom → colour matrix → neutral tone mapping → grain → view mask.
 * Bloom's blur passes are skipped entirely under lamps that don't use it.
 * Takes over rendering at priority 1.
 */
const camKey = new Float64Array(32);
const maskKey = { value: '' };
const maskMat = new MeshBasicMaterial({ color: 0xffffff, blending: AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
/** D (08): draws each focused sample's own meshes (not its base or shadows) into the mask, by weight. */
function renderFocusMask(gl: WebGLRenderer, scene: Scene, camera: Camera, target: WebGLRenderTarget, weights: Map<string, number>) {
  const prevTarget = gl.getRenderTarget(), prevAuto = gl.autoClear, prevShadow = gl.shadowMap.autoUpdate;
  gl.setRenderTarget(target);
  gl.setClearColor(0x000000, 0);
  gl.clear(true, false, false);
  gl.autoClear = false;
  gl.shadowMap.autoUpdate = false;
  for (const child of scene.children) {
    const slug = child.userData.slug as string | undefined;
    const w = slug ? weights.get(slug) ?? 0 : 0;
    if (w <= 0.001) continue;
    let root: Object3D | null = null;
    child.traverse((o) => {
      if (!root && o.userData.focusRoot) root = o;
    });
    if (!root) continue;
    const swapped: [Mesh, Material | Material[]][] = [];
    (root as Object3D).traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        swapped.push([m, m.material]);
        m.material = maskMat;
      }
    });
    maskMat.color.setScalar(w);
    gl.render(root, camera);
    for (const [m, mat] of swapped) m.material = mat;
  }
  gl.autoClear = prevAuto;
  gl.shadowMap.autoUpdate = prevShadow;
  gl.setRenderTarget(prevTarget);
}

export function Post() {
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = useReducedMotion();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const rendererSize = useMemo(() => new Vector2(), [gl]);
  const fitted = useRef('');
  const lastFrame = useRef<{ view: ViewSnapshot; width: number; height: number } | null>(null);

  // mobile tier: 2× MSAA and half-resolution bloom
  const mobile = isMobileTier();
  // ?nobloom: A/B test a lamp's look without bloom
  const noBloom = (typeof window !== 'undefined' && window.location.search.includes('nobloom')) || perfOff('bloom');
  // MSAA on the composer's render target (the canvas's own antialias does nothing under a post
  // chain): 4× desktop, 2× mobile, capped at what the GPU supports. SMAA when MSAA is unavailable.
  // B2 (08): MSAA 4x kept on desktop (SMAA broke the frame's thin chamfer highlights into dashes that
  // crawl under parallax: tools/lamp-review/08/aa-compare.png). `?perf&no=msaa4` tries 2x, `no=msaa` SMAA.
  const samples = perfOff('msaa') ? 0 : Math.min(mobile || perfOff('msaa4') ? 2 : 4, gl.capabilities.isWebGL2 ? gl.capabilities.maxSamples : 0);
  const composer = useMemo(() => new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: samples }), [gl, samples]);
  postApi.samples = samples;
  const fx = useMemo(() => {
    const focusMask = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    const noise = new GrainEffect();
    noise.blendMode.opacity.value = 0;
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: 0, luminanceThreshold: 1, luminanceSmoothing: 0.2, radius: 0.7, resolutionScale: mobile ? 0.5 : 1 });
    const coverage = new CoveragePass();
    const update = bloom.update.bind(bloom);
    bloom.update = (renderer, inputBuffer, deltaTime) => {
      if (bloom.intensity > 0.001) update(renderer, inputBuffer, deltaTime);
    };
    // desktop: subtle SSAO at half resolution (mobile relies on the baked AO only)
    const normals = mobile || perfOff('ssao') ? null : new BoothNormalPass(scene, camera, { resolutionScale: 0.5 });
    const ssao = normals
      ? new SSAOEffect(camera, normals.texture, {
          resolutionScale: 0.5,
          samples: 12,
          rings: 5,
          worldDistanceThreshold: 3,
          worldDistanceFalloff: 0.5,
          worldProximityThreshold: 0.03,
          worldProximityFalloff: 0.015,
          minRadiusScale: 0.2,
          radius: 0.06,
          intensity: 1.6,
          luminanceInfluence: 0.55,
          bias: 0.03,
          fade: 0.02,
        })
      : null;
    return {
      normals,
      ssao,
      sanitize: new ShaderPass(sanitizeMaterial(), 'inputBuffer'),
      bloom,
      matrix: new ColorMatrixEffect(),
      tone: new BoothToneEffect(),
      noise,
      coverage,
      mask: new ViewMaskEffect(coverage.target),
      focusMask,
      focus: mobile || perfOff('focus') ? null : new BoothFocusEffect(focusMask.texture),
    };
  }, [mobile, scene, camera]);

  // ?perf: per-pass timing. Each pass is closed with a 1px readback (a real GPU sync point), so the
  // numbers are each pass's own cost; window.__boothPasses(n) renders n frames and averages them.
  useEffect(() => {
    if (!PERF) return;
    const times = new Map<string, number[]>();
    let on = false;
    const ctx = gl.getContext();
    const px = new Uint8Array(4);
    const sync = () => ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
    const wrap = () => {
      for (const pass of composer.passes as (Pass & { __timed?: boolean })[]) {
        if (pass.__timed) continue;
        pass.__timed = true;
        const orig = pass.render.bind(pass);
        pass.render = (...a: Parameters<Pass['render']>) => {
          if (!on) return orig(...a);
          const t0 = performance.now();
          orig(...a);
          sync();
          const name = pass.name || 'pass';
          (times.get(name) ?? times.set(name, []).get(name)!).push(performance.now() - t0);
        };
      }
    };
    (window as unknown as { __boothPasses: (n?: number, moving?: boolean) => unknown }).__boothPasses = (n = 20, moving = false) => {
      wrap();
      times.clear();
      on = true;
      const total = window.__boothBench?.(n, moving);
      on = false;
      const out: Record<string, number> = {};
      let sum = 0;
      for (const [k, v] of times) {
        v.sort((a, b) => a - b);
        out[k] = +v[Math.floor(v.length / 2)].toFixed(2);
        sum += out[k];
      }
      out['scene prep (useFrame: reflector, contact shadows, shadow map)'] = total ? +(total.p50 - sum).toFixed(2) : NaN;
      out.frameP50 = total?.p50 ?? NaN;
      out.frameP95 = total?.p95 ?? NaN;
      return out;
    };
  }, [gl, composer]);

  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = NoToneMapping; // tone mapping happens in the effect pass
    composer.addPass(new ViewsPass(scene, camera));
    if (fx.normals) composer.addPass(fx.normals);
    composer.addPass(fx.coverage);
    composer.addPass(fx.sanitize);
    if (samples < 2) composer.addPass(new EffectPass(camera, new SMAAEffect()));
    if (fx.focus) composer.addPass(new EffectPass(camera, fx.focus));
    const effects = [fx.ssao, fx.bloom, fx.matrix, fx.tone, fx.noise, fx.mask].filter((e): e is Effect => e !== null);
    const finalPass = new EffectPass(camera, ...effects);
    // dark lamps (UV, AFTER DARK) live in the bottom few 8-bit codes: dither the output so gradients don't contour
    finalPass.dithering = true;
    composer.addPass(finalPass);
    return () => {
      composer.removeAllPasses();
      gl.toneMapping = prev;
    };
  }, [composer, scene, camera, gl, fx, samples]);

  // Resize every buffer whenever the canvas size or its pixel ratio changes (an adaptive DPR step
  // changes the drawing buffer without changing the CSS size). Synchronous with the canvas resize,
  // so no frame is ever drawn into a stale-sized buffer.
  useLayoutEffect(() => {
    const fit = () => {
      gl.getSize(rendererSize);
      composer.setSize(rendererSize.x, rendererSize.y);
      const pr = gl.getPixelRatio();
      fx.focusMask.setSize(Math.max(1, Math.round((rendererSize.x * pr) / 2)), Math.max(1, Math.round((rendererSize.y * pr) / 2)));
      fx.focus?.setScale(rendererSize.y * pr);
      fitted.current = `${rendererSize.x}:${rendererSize.y}:${pr}`;
    };
    fit();
    postApi.resize = fit;
    const snapshot = () => {
      const last = lastFrame.current;
      if (!last) return false;
      gl.getSize(rendererSize);
      if (rendererSize.x !== last.width || rendererSize.y !== last.height) gl.setSize(last.width, last.height, false);
      fit();
      // Draw the last camera and scene through their prior masks. No useFrame update, model
      // movement or new viewport fitting occurs before this image is copied to the cover.
      markDirty('resize snapshot', ['normals'], 1);
      withViewSnapshot(last.view, () => composer.render(0));
      return true;
    };
    postApi.snapshot = snapshot;
    return () => { if (postApi.snapshot === snapshot) postApi.snapshot = () => false; };
  }, [composer, size.width, size.height, dpr, fx, gl, rendererSize]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, dt) => {
    gl.getSize(rendererSize);
    if (fitted.current !== `${rendererSize.x}:${rendererSize.y}:${gl.getPixelRatio()}`) postApi.resize();
    // B1 (08): the camera moved (parallax, a scroll moving the stage, a resize, a dolly): every
    // side render that depends on the view is dirty for this frame
    camera.updateMatrixWorld();
    const cm = camera.matrixWorld.elements, pm = camera.projectionMatrix.elements;
    let moved = false;
    for (let i = 0; i < 16; i++) if (Math.abs(cm[i] - camKey[i]) > 1e-6 || Math.abs(pm[i] - camKey[16 + i]) > 1e-6) moved = true;
    if (moved) {
      for (let i = 0; i < 16; i++) (camKey[i] = cm[i]), (camKey[16 + i] = pm[i]);
      markDirty('camera', ['reflector', 'normals'], 1);
    }
    // D (08): the focus weights. The hovered (or keyboard-focused) sample ramps to 1 over 250ms,
    // the others back to 0 over 300ms; at rest on a project page the tray object holds 0.6.
    if (fx.focus) {
      const { activeSlug, keySlug, houseLights } = useBooth.getState();
      const hover = reducedMotion || houseLights ? null : hoverFocus.slug ?? keySlug;
      const step = Math.min(0.1, Math.max(0, dt));
      const W = focusState.weights;
      for (const slug of Object.keys(STAGING)) {
        const goal = reducedMotion || houseLights ? 0 : slug === hover ? 1 : !hover && slug === activeSlug ? 0.6 : 0;
        const w = W.get(slug) ?? 0;
        const nw = goal > w ? Math.min(goal, w + step / 0.25) : Math.max(goal, w - step / 0.3);
        if (nw > 0) W.set(slug, nw);
        else W.delete(slug);
      }
      let sMax = 0;
      for (const w of W.values()) sMax = Math.max(sMax, w);
      const ease = (x: number) => x * x * (3 - 2 * x);
      const strength = ease(sMax);
      if ((strength > 0) !== (focusState.strength > 0)) logEvent(`focus pass strength ${strength > 0 ? '0 → on' : '→ 0'}`);
      focusState.strength = strength;
      if (strength > 0) {
        // the mask is redrawn only when the weights, the camera or an object changed
        const key = [...W].map(([k, v]) => `${k}:${v.toFixed(3)}`).join(',');
        if (key !== maskKey.value || moved || isDirty('normals')) {
          maskKey.value = key;
          renderFocusMask(gl, scene, camera, fx.focusMask, W);
        }
        if (W.size && [...W.values()].some((w) => w > 0 && w < 1 && w !== 0.6)) invalidate();
      }
    }
    fx.bloom.intensity = noBloom ? 0 : postState.bloomIntensity;
    fx.bloom.luminanceMaterial.threshold = postState.bloomThreshold;
    fx.noise.blendMode.opacity.value = postState.grain;
    (fx.matrix.uniforms.get('matrix')!.value as Matrix3).copy(postState.matrix);
    // every presented frame starts fully transparent: no pixel of an earlier frame can survive
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    composer.render(dt);
    lastFrame.current = { view: { stage: stageRect(), frame: frameRect(), ...viewportSize() }, width: rendererSize.x, height: rendererSize.y };
    // A2 test hook: the mean luminance of the stage as presented, one entry per frame. A GPU
    // readback, so it exists only with ?perf (H1): production never reads pixels back.
    const cap = PERF ? window.__boothCapture : undefined;
    if (cap?.on) {
      const r = stageRect();
      const ctx = gl.getContext();
      const k = gl.getPixelRatio();
      if (r) {
        // During resize the previous drawing buffer can still be stretched over the new CSS
        // viewport. Map CSS coordinates to that actual buffer instead of assuming its DPR.
        const rect = cap.visibleContent ? gl.domElement.getBoundingClientRect() : null;
        const kx = rect ? ctx.drawingBufferWidth / rect.width : k;
        const ky = rect ? ctx.drawingBufferHeight / rect.height : k;
        const left = rect?.left ?? 0, top = rect?.top ?? 0;
        const x0 = Math.max(0, Math.floor((r.left - left) * kx)), x1 = Math.min(ctx.drawingBufferWidth, Math.floor((r.left + r.width - left) * kx));
        const yTop = Math.max(0, (r.top - top) * ky), yBot = Math.min(ctx.drawingBufferHeight, (r.top + r.height - top) * ky);
        const w = x1 - x0, h = Math.floor(yBot - yTop);
        if (w > 0 && h > 0) {
          const buf = new Uint8Array(w * h * 4);
          const bottom = Math.floor(ctx.drawingBufferHeight - yBot);
          ctx.readPixels(x0, bottom, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
          const cover = cap.visibleContent ? gl.domElement.closest('.booth-canvas')?.querySelector<HTMLCanvasElement>('.booth-cover') : null;
          const coverOpacity = cover && !cover.hidden ? Number(getComputedStyle(cover).opacity) : 0;
          const coverRect = coverOpacity > 0 ? cover!.getBoundingClientRect() : null;
          const coverPixels = coverRect ? cover!.getContext('2d')?.getImageData(0, 0, cover!.width, cover!.height).data : null;
          const liveOpacity = cap.visibleContent ? Number(getComputedStyle(gl.domElement).opacity) : 1;
          const paper = cap.visibleContent ? getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g)?.map(Number) : null;
          const paperLum = paper ? 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2] : 0;
          let sum = 0, n = 0, pixels = 0, liveAlpha = 0;
          for (let i = 0; i < buf.length; i += 4 * 37) {
            const lum = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
            if (!cap.visibleContent) { sum += lum; n++; continue; }
            let coverAlpha = 0, coverLum = 0;
            if (coverPixels && coverRect) {
              const cssX = left + (x0 + (i / 4) % w + 0.5) / kx;
              const cssY = top + (ctx.drawingBufferHeight - bottom - Math.floor(i / 4 / w) - 0.5) / ky;
              const cx = Math.floor((cssX - coverRect.left) * cover!.width / coverRect.width);
              const cy = Math.floor((cssY - coverRect.top) * cover!.height / coverRect.height);
              if (cx >= 0 && cy >= 0 && cx < cover!.width && cy < cover!.height) {
                const j = (cy * cover!.width + cx) * 4;
                coverAlpha = coverPixels[j + 3] / 255 * coverOpacity;
                coverLum = (0.2126 * coverPixels[j] + 0.7152 * coverPixels[j + 1] + 0.0722 * coverPixels[j + 2]) * coverAlpha;
              }
            }
            // WebGL output is premultiplied; 2D getImageData is not. Composite both layers,
            // then the page paper behind them, to measure the pixels actually presented.
            sum += coverLum + lum * liveOpacity * (1 - coverAlpha);
            n += coverAlpha + buf[i + 3] / 255 * liveOpacity * (1 - coverAlpha);
            liveAlpha += buf[i + 3] / 255;
            pixels++;
          }
          const emptyLive = cap.visibleContent && coverOpacity < 0.999 && liveOpacity > 0 && liveAlpha === 0;
          const mean = cap.visibleContent ? (sum + paperLum * (pixels - n)) / pixels : sum / n;
          cap.lums.push(sum > 0 && n > 0 && !emptyLive ? +mean.toFixed(2) : 0);
        }
      }
    }

    // the spectro loupe: one pixel of what was just drawn (premultiplied; un-premultiplied here)
    const lp = loupeState.pending;
    if (lp) {
      loupeState.pending = null;
      const ctx = gl.getContext();
      const k = gl.getPixelRatio();
      const px = new Uint8Array(4);
      ctx.readPixels(Math.floor(lp.x * k), Math.floor(ctx.drawingBufferHeight - lp.y * k), 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      const a = px[3] / 255;
      lp.resolve(a > 0 ? [Math.round(px[0] / a), Math.round(px[1] / a), Math.round(px[2] / a), px[3]] : null);
    }

    if (postState.diagnose) {
      // Read back the final frame in the same task (no preserveDrawingBuffer needed).
      const ctx = gl.getContext();
      const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
      const px = new Uint8Array(4);
      const sample = (fx_: number, fy: number) => {
        ctx.readPixels(Math.floor(w * fx_), Math.floor(h * fy), 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        return Array.from(px);
      };
      const report = {
        ...postState.diagnose,
        glError: ctx.getError(),
        pixels: { centre: sample(0.5, 0.5), row: sample(0.5, 0.3), leftWall: sample(0.05, 0.6) },
        renderer: (ctx.getExtension('WEBGL_debug_renderer_info') && ctx.getParameter(0x9246)) || 'n/a',
      };
      // stringified so it can be copied straight out of the console
      console.warn('[booth] lamp rig report ' + JSON.stringify(report));
      postState.diagnose = null;
    }
  }, 1);

  return null;
}
