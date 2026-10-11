'use client';

/**
 * Coarse GPU check without a benchmark: no WebGL, or a software renderer on a real visit, means the
 * booth steps aside for house lights. Override with ?gpu=high / ?gpu=low.
 */
let cached: 'high' | 'low' | null = null;

const SOFTWARE = /swiftshader|llvmpipe|software/i;

export function gpuTier(): 'high' | 'low' {
  if (cached) return cached;
  if (typeof window === 'undefined') return 'low';
  const q = new URLSearchParams(window.location.search).get('gpu');
  if (q === 'high' || q === 'low') return (cached = q);
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return (cached = 'low');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cached = SOFTWARE.test(r) && !navigator.webdriver ? 'low' : 'high';
  } catch {
    cached = 'low';
  }
  return cached;
}
