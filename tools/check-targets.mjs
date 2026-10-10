import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * P1 (09): touch targets and type size. On every route, every visible interactive element (links,
 * buttons, controls) must be at least 24x24px on desktop (1568x980, mouse) and 44x44px on touch
 * (390x844 phone, 820x1180 tablet). Links inside running text are exempt (WCAG 2.5.8 inline
 * exception), and so is the booth's invisible keyboard layer (it is sized to each sample). On
 * phones nothing a visitor reads is under 12px; on desktop nothing under 11px.
 *   node tools/check-targets.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const ROUTES = (process.env.ROUTES || '/,/about,/archive,/work/sonde,/work/jsw-sports,/house-lights,/nope-404').split(',');
const b = await launch({ args: [] });
let fails = 0;
for (const [name, vp, touch] of [['desktop', { width: 1568, height: 980 }, false], ['phone', { width: 390, height: 844 }, true], ['tablet', { width: 820, height: 1180 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: touch && vp.width < 600, hasTouch: touch, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vm:opened:v1', '1'); sessionStorage.setItem('vm:hint:v1', '1'); } catch {} });
  const p = await ctx.newPage();
  p.setDefaultTimeout(timeoutMs());
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    const min = touch ? 44 : 24, minFont = touch && vp.width < 600 ? 12 : 11;
    const r = await p.evaluate(({ min, minFont }) => {
      const vis = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 32)}"`;
      const inline = (el) => {
        if (el.tagName !== 'A') return false;
        const p = el.closest('p, li, dd');
        return p && !p.matches('.cert__links, .nf__links') && (p.textContent || '').trim().length > (el.textContent || '').trim().length + 12;
      };
      const small = [];
      for (const el of document.querySelectorAll('a[href], button, [role="button"], input, select, summary, [tabindex="0"]')) {
        if (!vis(el) || el.closest('.sr-only') || el.matches('.skiplink, .booth-focus__item, .work__turn') || getComputedStyle(el).pointerEvents === 'none' || inline(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < min - 0.5 || r.height < min - 0.5) small.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      const tiny = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !(n.textContent || '').trim() || el.closest('[aria-hidden="true"], .sr-only, script, style, noscript, svg') || !vis(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < minFont - 0.05) tiny.add(`${label(el)} ${fs}px`);
      }
      return { small, tiny: [...tiny] };
    }, { min, minFont });
    const bad = r.small.length + r.tiny.length;
    fails += bad;
    console.log(`${bad ? '✗' : '✓'} ${name} ${route}: ${r.small.length} targets under ${min}px, ${r.tiny.length} texts under ${minFont}px`);
    for (const s of r.small.slice(0, 12)) console.log(`    target ${s}`);
    for (const s of r.tiny.slice(0, 12)) console.log(`    text ${s}`);
  }
  await ctx.close();
}
await b.close();
process.exit(fails ? 1 : 0);
