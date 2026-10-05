'use client';

/**
 * C6 (08): `?perf&events` shows a small on-screen log, with timestamps, of everything that can make
 * a visible change: env captures, shadow / contact / reflector re-renders, model loads and fades,
 * DPR steps, render-on-demand state changes, pass strength changes and the poster crossfade. For
 * screen recordings of any remaining flicker. Costs nothing when off.
 */
export const EVENTS_ON = typeof window !== 'undefined' && /[?&]perf\b/.test(window.location.search) && /[?&]events\b/.test(window.location.search);

const lines: string[] = [];
let el: HTMLDivElement | null = null;
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

export function logEvent(msg: string) {
  if (!EVENTS_ON) return;
  const t = ((performance.now() - t0) / 1000).toFixed(3).padStart(8, ' ');
  lines.push(`${t}s  ${msg}`);
  if (lines.length > 40) lines.shift();
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;right:8px;top:8px;z-index:60;max-width:min(560px,90vw);max-height:46vh;overflow:hidden;pointer-events:none;' +
      'background:#111d;color:#cfe;font:10px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:3px;white-space:pre';
    document.body.appendChild(el);
  }
  el.textContent = lines.join('\n');
}
