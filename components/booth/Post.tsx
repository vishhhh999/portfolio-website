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
import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
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
  type WebGLRenderer,
} from 'three';
import { stageRect } from '@/lib/views';
import { isMobileTier } from '@/lib/perfTier';
import { loupeState } from '@/lib/loupe';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { hoverFocus } from './focus';
import { STAGING, TRAY } from './staging';

declare global {
  interface Window {
    /** tools/check-flicker.mjs: when on, every presented frame's mean stage luminance is recorded. */
    __boothCapture?: { on: boolean; lums: number[] };
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
export const postApi = { resize: () => {}, samples: 0 };


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
    super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
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
          vec2 q = (uv - box.xy) / max(box.zw - box.xy, vec2(1e-4)) - 0.5;
          c *= 1.0 - 0.1 * smoothstep(0.3, 0.72, length(q * vec2(1.0, 0.86)));
        }
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map<string, Uniform>([
          ['exposure', new Uniform(1)],
          ['neutral', new Uniform(1)],
          ['box', new Uniform(new Vector4(0, 0, 0, 0))],
        ]),
      },
    );
  }
  update() {
    (this.uniforms.get('exposure') as Uniform<number>).value = postState.exposure * EXPOSURE_OVERRIDE;
    (this.uniforms.get('neutral') as Uniform<number>).value = TONE_OVERRIDE ?? (postState.neutral ? 1 : 0);
    setStageBox(this.uniforms.get('box')!.value as Vector4);
  }
}

/**
 * J4: a subtle depth of field (desktop): focus on the sample on the tray, or on the one under the
 * pointer; everything nearer or further softens a little (a 12-tap disc, a few px at most, small
 * bokeh). Off when nothing is in focus, on mobile and under reduced motion. Booth stage only.
 */
export const dofState = { focus: 1, blur: 0 };
class BoothDofEffect extends Effect {
  constructor() {
    super(
      'BoothDofEffect',
      /* glsl */ `
      uniform float focusDist;
      uniform float maxBlur;
      uniform vec4 box;
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        bool inside = uv.x >= box.x && uv.x <= box.z && uv.y >= box.y && uv.y <= box.w;
        if (!inside || maxBlur < 0.05 || depth >= 1.0) { outputColor = inputColor; return; }
        float z = -getViewZ(depth);
        float coc = clamp(abs(z - focusDist) / max(z, 1e-3) * 2.4, 0.0, 1.0) * maxBlur;
        if (coc < 0.4) { outputColor = inputColor; return; }
        vec4 acc = inputColor;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt((float(i) + 0.5) / 12.0) * coc;
          acc += texture2D(inputBuffer, uv + vec2(cos(a), sin(a)) * r * texelSize);
        }
        outputColor = acc / 13.0;
      }`,
      {
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map<string, Uniform>([
          ['focusDist', new Uniform(1)],
          ['maxBlur', new Uniform(0)],
          ['box', new Uniform(new Vector4(0, 0, 0, 0))],
        ]),
      },
    );
  }
  update() {
    (this.uniforms.get('focusDist') as Uniform<number>).value = dofState.focus;
    (this.uniforms.get('maxBlur') as Uniform<number>).value = dofState.blur;
    setStageBox(this.uniforms.get('box')!.value as Vector4);
  }
}

/** The booth stage in uv space (x0, y0, x1, y1); empty when there is no stage. */
function setStageBox(box: Vector4) {
  const r = stageRect();
  if (!r) return box.set(0, 0, 0, 0);
  const W = window.innerWidth, H = window.innerHeight;
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
const dofAt = new Vector3();
const dofDir = new Vector3();

export function Post() {
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = useReducedMotion();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  // mobile tier: 2× MSAA and half-resolution bloom
  const mobile = isMobileTier();
  // ?nobloom: A/B test a lamp's look without bloom
  const noBloom = (typeof window !== 'undefined' && window.location.search.includes('nobloom')) || perfOff('bloom');
  // MSAA on the composer's render target (the canvas's own antialias does nothing under a post
  // chain): 4× desktop, 2× mobile, capped at what the GPU supports. SMAA when MSAA is unavailable.
  const samples = perfOff('msaa') ? 0 : Math.min(mobile ? 2 : 4, gl.capabilities.isWebGL2 ? gl.capabilities.maxSamples : 0);
  const composer = useMemo(() => new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: samples }), [gl, samples]);
  postApi.samples = samples;
  const fx = useMemo(() => {
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
      dof: mobile || perfOff('dof') ? null : new BoothDofEffect(),
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
    (window as unknown as { __boothPasses: (n?: number) => unknown }).__boothPasses = (n = 20) => {
      wrap();
      times.clear();
      on = true;
      const total = window.__boothBench?.(n);
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
    if (fx.dof) composer.addPass(new EffectPass(camera, fx.dof));
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
    composer.setSize(size.width, size.height);
    postApi.resize = () => composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height, dpr]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, dt) => {
    // J4: focus on the tray object, else the sample under the pointer (or keyboard focus); none otherwise
    if (fx.dof) {
      const { activeSlug, keySlug } = useBooth.getState();
      const slug = activeSlug ?? hoverFocus.slug ?? keySlug;
      let goal = 0;
      if (slug && !reducedMotion && STAGING[slug]) {
        const st = STAGING[slug];
        if (activeSlug) dofAt.set(0, TRAY.top + st.object.h / 2, TRAY.z);
        else dofAt.set(st.x, st.base.h + st.object.h / 2, st.z);
        camera.getWorldDirection(dofDir);
        dofState.focus = dofAt.sub(camera.position).dot(dofDir);
        goal = (2.2 * size.height * dpr) / 1000;
      }
      const k = 1 - Math.exp(-Math.min(0.1, Math.max(0, dt)) * 6);
      dofState.blur += (goal - dofState.blur) * k;
      if (Math.abs(goal - dofState.blur) > 0.02) invalidate();
      else dofState.blur = goal;
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
    // A2 test hook: the mean luminance of the stage as presented, one entry per frame. A GPU
    // readback, so it exists only with ?perf (H1): production never reads pixels back.
    const cap = PERF ? window.__boothCapture : undefined;
    if (cap?.on) {
      const r = stageRect();
      const ctx = gl.getContext();
      const k = gl.getPixelRatio();
      if (r) {
        const x0 = Math.max(0, Math.floor(r.left * k)), x1 = Math.min(ctx.drawingBufferWidth, Math.floor((r.left + r.width) * k));
        const yTop = Math.max(0, r.top * k), yBot = Math.min(ctx.drawingBufferHeight, (r.top + r.height) * k);
        const w = x1 - x0, h = Math.floor(yBot - yTop);
        if (w > 0 && h > 0) {
          const buf = new Uint8Array(w * h * 4);
          ctx.readPixels(x0, Math.floor(ctx.drawingBufferHeight - yBot), w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
          let sum = 0, n = 0;
          for (let i = 0; i < buf.length; i += 4 * 37) {
            sum += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
            n++;
          }
          cap.lums.push(+(sum / n).toFixed(2));
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
