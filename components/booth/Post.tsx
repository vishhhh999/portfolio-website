'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  Pass,
  ShaderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { useEffect, useMemo } from 'react';
import {
  HalfFloatType,
  Matrix3,
  NoToneMapping,
  ShaderMaterial,
  Uniform,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { planeEntries, stageRect } from '@/lib/views';

/** Written by the lamp rig every frame, read here. */
export const postState = {
  bloomIntensity: 0,
  bloomThreshold: 1,
  grain: 0,
  matrix: new Matrix3(),
  /** Set by the rig to request a one-off console report after the next frame. */
  diagnose: null as null | Record<string, unknown>,
};

/** The proof-strip layer (screen-space planes), registered by ProofLayer when a page has deliverables. */
export const proofLayer: { scene: Scene | null; camera: Camera | null } = { scene: null, camera: null };

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
      const x = Math.round(s.left * dpr);
      const w = Math.round(s.width * dpr);
      const h = Math.round(s.height * dpr);
      const y = Math.round(H - (s.top + s.height) * dpr);
      inputBuffer.viewport.set(x, y, w, h);
      inputBuffer.scissor.set(x, Math.max(0, y), w, Math.min(h, H - Math.max(0, y)));
      inputBuffer.scissorTest = true;
      renderer.setRenderTarget(inputBuffer);
      renderer.clear(true, true, false); // scene background fills the stage only
      renderer.render(this.booth, this.boothCamera);
      inputBuffer.viewport.set(0, 0, inputBuffer.width, H);
      inputBuffer.scissorTest = false;
      renderer.setRenderTarget(inputBuffer);
    }

    if (proofLayer.scene && proofLayer.camera && planeEntries().size) {
      renderer.clearDepth();
      renderer.render(proofLayer.scene, proofLayer.camera);
    }
    renderer.autoClear = autoClear;
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
export function Post() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 4 }), [gl]);
  const fx = useMemo(() => {
    const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SOFT_LIGHT });
    noise.blendMode.opacity.value = 0;
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: 0, luminanceThreshold: 1, luminanceSmoothing: 0.2, radius: 0.7 });
    const coverage = new CoveragePass();
    const update = bloom.update.bind(bloom);
    bloom.update = (renderer, inputBuffer, deltaTime) => {
      if (bloom.intensity > 0.001) update(renderer, inputBuffer, deltaTime);
    };
    return {
      sanitize: new ShaderPass(sanitizeMaterial(), 'inputBuffer'),
      bloom,
      matrix: new ColorMatrixEffect(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      noise,
      coverage,
      mask: new ViewMaskEffect(coverage.target),
    };
  }, []);

  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = NoToneMapping; // tone mapping happens in the effect pass
    composer.addPass(new ViewsPass(scene, camera));
    composer.addPass(fx.coverage);
    composer.addPass(fx.sanitize);
    composer.addPass(new EffectPass(camera, fx.bloom, fx.matrix, fx.tone, fx.noise, fx.mask));
    return () => {
      composer.removeAllPasses();
      gl.toneMapping = prev;
    };
  }, [composer, scene, camera, gl, fx]);

  useEffect(() => composer.setSize(size.width, size.height), [composer, size.width, size.height]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, dt) => {
    fx.bloom.intensity = postState.bloomIntensity;
    fx.bloom.luminanceMaterial.threshold = postState.bloomThreshold;
    fx.noise.blendMode.opacity.value = postState.grain;
    (fx.matrix.uniforms.get('matrix')!.value as Matrix3).copy(postState.matrix);
    composer.render(dt);

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
