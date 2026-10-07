/**
 * F3 + P4 (09): the lamp pill never covers what a visitor reads or clicks, and the masthead never
 * collides with itself.
 *  1. On every project page at 1568x980 and 390x844, scrolled top to bottom in steps (each step left
 *     to settle: the smooth scroll and the pill's 1.2s idle return), the pill, wherever it is shown,
 *     never intersects the calibration label, any proof, any link button or end card.
 *  2. At 390, 768, 1024, 1440, 1920 and 2560 wide, the masthead's wordmark, nav items and the
 *     "Book a viewing" button never overlap each other or leave the viewport, and the pill (when
 *     floating) never overlaps the masthead.
 *   node tools/check-pill.mjs   (against a running build)   ONLY=sonde,shunya to limit pages
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const SLUGS = (process.env.ONLY || 'too-yumm,jsw-sports,mitooshi,sonde,house-of-hex,bengal-t20,sook,shunya,indo-thai').split(',');
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
const hit = (a, c) => a.left < c.right - 0.5 && a.right > c.left + 0.5 && a.top < c.bottom - 0.5 && a.bottom > c.top + 0.5;

if (!process.env.SKIP_MASTHEAD) {
  for (const w of [390, 768, 1024, 1440, 1920, 2560]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 1000 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    for (const route of ['/about', '/archive']) {
      await p.goto(BASE + route, { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const R = (el) => JSON.parse(JSON.stringify(el.getBoundingClientRect()));
        const parts = [document.querySelector('.wordmark'), ...document.querySelectorAll('.sitenav > *')].filter(Boolean).map((el) => ({ name: (el.textContent || '').trim(), r: R(el) }));
        return { parts, vw: innerWidth };
      });
      const bad = [];
      for (let i = 0; i < r.parts.length; i++) {
        const a = r.parts[i];
        if (a.r.left < -0.5 || a.r.right > r.vw + 0.5) bad.push(`${a.name} leaves the viewport`);
        for (let j = i + 1; j < r.parts.length; j++) if (hit(a.r, r.parts[j].r)) bad.push(`${a.name} overlaps ${r.parts[j].name}`);
      }
      fails += bad.length;
      console.log(`${bad.length ? '✗' : '✓'} masthead ${w} ${route}${bad.length ? ': ' + bad.join('; ') : ''}`);
    }
    await ctx.close();
  }
}

for (const [name, vp, mobile] of [['1568', { width: 1568, height: 980 }, false], ['390', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vm:opened:v1', '1'); } catch {} });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  for (const slug of SLUGS) {
    await p.goto(`${BASE}/work/${slug}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const steps = Math.ceil(total / (vp.height * 0.45)) + 1;
    const bad = [];
    for (let i = 0; i <= steps; i++) {
      const y = Math.min(total, Math.round((i * total) / steps));
      await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
      // a check mid-move (the pill decides every frame while the page moves) and one at rest
      for (const wait of [250, 1700]) {
        await p.waitForTimeout(wait);
        const r = await p.evaluate(() => {
          const pill = document.querySelector('.panel[data-place="float"]');
          if (!pill) return { shown: false };
          const cs = getComputedStyle(pill);
          const shown = pill.getAttribute('data-away') !== 'true' && +cs.opacity > 0.05;
          const pr = pill.getBoundingClientRect();
          const prot = [...document.querySelectorAll('.calib, .proof__image, .livelink, .workend__card, .masthead')].map((el) => ({ name: el.className.split(' ')[0], r: JSON.parse(JSON.stringify(el.getBoundingClientRect())) }));
          return { shown, pr: JSON.parse(JSON.stringify(pr)), prot };
        });
        if (!r.shown) continue;
        for (const q of r.prot) if (hit(r.pr, q.r)) bad.push(`at y=${y} (+${wait}ms) over .${q.name}`);
      }
    }
    fails += bad.length;
    console.log(`${bad.length ? '✗' : '✓'} pill ${name} /work/${slug}: ${steps + 1} scroll steps${bad.length ? ': ' + [...new Set(bad)].slice(0, 6).join('; ') : ''}`);
  }
  await ctx.close();
}
await b.close();
process.exit(fails ? 1 : 0);
