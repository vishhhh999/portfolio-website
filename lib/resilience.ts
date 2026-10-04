'use client';

/**
 * Resilience (I4). The booth steps aside on its own in two cases, always into house lights (the
 * plain, fast index), always with one quiet line saying why:
 *   - the WebGL context is lost: house lights at once; the booth comes back when it is restored
 *   - the GPU is too weak: the browser reports a major performance caveat (a software renderer),
 *     or frames stay over 50ms (p95) after the resolution has stepped down as far as it goes. Then
 *     house lights for the rest of the session, until the visitor turns the booth back on.
 * Never under automation (navigator.webdriver) or with ?gpu=high: tests and reviews see the booth.
 */
export const AUTO_KEY = 'vm:autoHouseLights:v1';
export const NOTICE = {
  speed: 'Switched to house lights for speed. Turn the booth back on anytime.',
  lost: 'The graphics card reset, so the booth is paused. It comes back on by itself.',
} as const;

type Go = (href: string) => void;
let go: Go | null = null;
let lostFrom: string | null = null;

/** The router hook-up (set once by BoothHost). */
export function setNavigator(fn: Go) {
  go = fn;
}

const exempt = () =>
  typeof navigator !== 'undefined' && (navigator.webdriver || new URLSearchParams(location.search).get('gpu') === 'high');

/** Too slow: house lights for this session (unless the visitor has turned the booth back on). */
export function autoHouseLights(reason: keyof typeof NOTICE) {
  if (exempt()) return;
  try {
    if (sessionStorage.getItem(AUTO_KEY) === 'declined') return;
    sessionStorage.setItem(AUTO_KEY, '1');
  } catch {}
  go?.(`/house-lights?notice=${reason}`);
}

/** The visitor turned the booth back on: never switch automatically again this session. */
export function declineAutoHouseLights() {
  try {
    if (sessionStorage.getItem(AUTO_KEY) === '1') sessionStorage.setItem(AUTO_KEY, 'declined');
  } catch {}
}

export function contextLost() {
  if (typeof location === 'undefined' || location.pathname === '/house-lights') return;
  lostFrom = location.pathname + location.search;
  go?.('/house-lights?notice=lost');
}
export function contextRestored() {
  if (lostFrom) go?.(lostFrom);
  lostFrom = null;
}

/** Does this GPU fail the "major performance caveat" test (software rendering)? Checked once. */
export function failsPerformanceCaveat(): boolean {
  if (exempt()) return false;
  try {
    const c = document.createElement('canvas');
    const strict = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) || c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (strict) {
      (strict as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
      return false;
    }
    // no strict context: only a caveat if a relaxed one works (otherwise there is no WebGL at all)
    const relaxed = document.createElement('canvas').getContext('webgl');
    return !!relaxed;
  } catch {
    return false;
  }
}
