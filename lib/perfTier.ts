'use client';

/**
 * Device budget, decided once at boot. Override with ?tier=phone|tablet|desktop.
 *   phone    coarse pointer and a short side under 600px          DPR start 1.5, 1024 shadow map
 *   tablet   coarse pointer otherwise (every iPad, iPad Pro too)   DPR start 1.5, 1024 shadow map
 *   desktop  a fine pointer                                        DPR start min(device, 2), 2048 map
 * The DPR then moves with the measured frame time (down when slow, back up when it recovers).
 */
export type PerfTier = 'phone' | 'tablet' | 'desktop';
export type PerfInfo = { tier: PerfTier; dprStart: number; dprMin: number; dprMax: number; shadowMap: number };

let cached: PerfInfo | null = null;

export function perfInfo(): PerfInfo {
  if (cached) return cached;
  if (typeof window === 'undefined') return { tier: 'desktop', dprStart: 1, dprMin: 1, dprMax: 1, shadowMap: 2048 };
  const q = new URLSearchParams(window.location.search).get('tier');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const short = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  const detected: PerfTier = !coarse ? 'desktop' : short < 600 ? 'phone' : 'tablet';
  const tier: PerfTier = q === 'phone' || q === 'tablet' || q === 'desktop' ? q : detected;
  const device = window.devicePixelRatio || 1;
  const dprMax = tier === 'desktop' ? Math.min(device, 2) : Math.min(device, 2);
  const dprStart = tier === 'desktop' ? dprMax : Math.min(device, 1.5);
  cached = { tier, dprStart, dprMin: Math.min(1, device), dprMax, shadowMap: tier === 'desktop' ? 2048 : 1024 };
  return cached;
}

export const isPhoneTier = () => perfInfo().tier === 'phone';
