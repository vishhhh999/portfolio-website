'use client';

/**
 * Performance tier, decided once at boot.
 *
 *   mobile  = coarse pointer + devicePixelRatio ≥ 2 + narrow viewport (phones, small tablets)
 *   desktop = everything else
 *
 * Also records the CPU core count and the GPU renderer string for the ?perf readout.
 * Override with ?tier=mobile / ?tier=desktop (e.g. to emulate the phone budget on a desktop).
 *
 * The mobile budget (see BoothCanvas / Post / LampRig / ProofLayer):
 *   DPR capped at 1.5 and stepped down adaptively · bloom at half resolution · one screen-spill
 *   area light instead of one per screen · 1024² shadow map · 2× MSAA.
 */
export type PerfTier = 'mobile' | 'desktop';
export type PerfInfo = {
  tier: PerfTier;
  cores: number;
  renderer: string;
  dpr: number;
  /** Starting DPR cap for this tier. */
  dprCap: number;
  forced: boolean;
};

let cached: PerfInfo | null = null;

function rendererString(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  } catch {
    return 'unknown';
  }
}

export function perfInfo(): PerfInfo {
  if (cached) return cached;
  if (typeof window === 'undefined') return { tier: 'desktop', cores: 0, renderer: '', dpr: 1, dprCap: 1.75, forced: false };
  const q = new URLSearchParams(window.location.search).get('tier');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = window.devicePixelRatio || 1;
  const narrow = Math.min(window.innerWidth, window.screen?.width ?? window.innerWidth) <= 900;
  const detected: PerfTier = coarse && dpr >= 2 && narrow ? 'mobile' : 'desktop';
  const tier: PerfTier = q === 'mobile' || q === 'desktop' ? q : detected;
  cached = {
    tier,
    cores: navigator.hardwareConcurrency || 0,
    renderer: rendererString(),
    dpr,
    dprCap: tier === 'mobile' ? 1.5 : 1.75,
    forced: q === 'mobile' || q === 'desktop',
  };
  return cached;
}

export const isMobileTier = () => perfInfo().tier === 'mobile';

/** Live adaptive state, written by the canvas, read by the ?perf readout. */
export const perfState = {
  dpr: 1,
  /** Steps taken down this session (never back up). */
  steps: 0,
  /** Frame deltas pinned near 33ms with no heavy frames: likely iOS Low Power Mode (readout only). */
  lowPower: false,
};
