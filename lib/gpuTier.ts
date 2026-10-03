'use client';

/**
 * Coarse GPU tier, without a network benchmark fetch. "low" means: render
 * the proof strip as plain DOM images (and, in Phase 6, the booth as stills).
 * Software renderers (SwiftShader, llvmpipe), old mobile GPUs and very small
 * devices are low. Override with ?gpu=high / ?gpu=low.
 */
import { perfInfo } from './perfTier';

let cached: 'high' | 'low' | null = null;

const LOW = /swiftshader|llvmpipe|software|mali-4|mali-t[0-8]|adreno \(tm\) [2-5]\d\d|powervr sgx|intel\(r\) hd graphics [2-4]\d{3}/i;

export function gpuTier(): 'high' | 'low' {
  if (cached) return cached;
  if (typeof window === 'undefined') return 'low';
  const q = new URLSearchParams(window.location.search).get('gpu');
  if (q === 'high' || q === 'low') return (cached = q);
  try {
    const renderer = perfInfo().renderer; // one throwaway context for both tiers
    if (renderer === 'no webgl') return (cached = 'low');
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    cached = LOW.test(renderer) || mem < 3 ? 'low' : 'high';
  } catch {
    cached = 'low';
  }
  return cached;
}

/** Lit WebGL planes for the proof strip: only on capable GPUs and without reduced motion. */
export function litPlanesEnabled() {
  if (typeof window === 'undefined') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return gpuTier() === 'high';
}
