'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { useEffect, useMemo } from 'react';
import { HalfFloatType, Matrix3, NoToneMapping, Uniform } from 'three';

/** Written by the lamp rig every frame, read here. */
export const postState = {
  bloomIntensity: 0,
  bloomThreshold: 1,
  grain: 0,
  matrix: new Matrix3(),
};

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
 * HDR post chain, driven straight through pmndrs/postprocessing (no React
 * wrapper, keeps the lazy chunk lean): bloom → colour matrix → neutral tone
 * mapping → film grain. Takes over rendering at priority 1.
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
    return {
      bloom: new BloomEffect({ mipmapBlur: true, intensity: 0, luminanceThreshold: 1, luminanceSmoothing: 0.2, radius: 0.7 }),
      matrix: new ColorMatrixEffect(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      noise,
    };
  }, []);

  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = NoToneMapping; // tone mapping happens in the effect pass
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, fx.bloom, fx.matrix, fx.tone, fx.noise));
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
  }, 1);

  return null;
}
