/**
 * A1 / A1b: no stale booth pixels anywhere. The page's DOM is hidden (visibility, so layout is
 * unchanged) over a pure magenta background, and the browser's own composite of the canvas is
 * captured: whatever the canvas presents outside the current view rects must be fully transparent
 * (the magenta shows through). Steps: on / and /work/too-yumm scroll 0 → 300 → 700 → 1200 → 0 with
 * pauses, then open a project from the booth. Also checks that the registered views match each
 * route: / → the cabinet stage; /work/* → the tray stage (+ proof planes only under AFTER DARK).
 *
 * L7 (09B): the shelf scrolled, and the live resize / rotation sequence (SKIP_SHAPES=1 to skip).
 *   node tools/check-smear.mjs [widths=1568,2560]
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
import sharp from 'sharp';
const BASE = process.env.BASE || 'http://localhost:3100';
const widths = (process.argv[2] || '1568,2560').split(',').map(Number);
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
const report = (ok, msg) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
};

const HIDE = `html, body { background: #ff00ff !important; } body > *:not(.booth-canvas), .booth-canvas ~ * { visibility: hidden !important; }
  body * { visibility: hidden !important; } .booth-canvas, .booth-canvas * { visibility: visible !important; }`;

async function check(p, label) {
  // let the clock draw whatever it is going to draw, then capture the composite with the DOM hidden
  await p.waitForTimeout(900);
  const views = await p.evaluate(() => window.__boothViews?.() ?? []);
  const vp = p.viewportSize();
  const tag = await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(80); // one composite with the DOM hidden; no layout change, so no redraw is needed
  const { data, info } = await sharp(await p.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const png = { data, width: info.width, height: info.height };
  await tag.evaluate((n) => n.remove());
  const inView = (x, y) => views.some((r) => x >= r.left - 2 && x < r.left + r.width + 2 && y >= r.top - 2 && y < r.top + r.height + 2);
  let bad = 0, total = 0, minY = Infinity, maxY = -1;
  for (let y = 0; y < png.height; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      if (inView(x * (vp.width / png.width), y * (vp.height / png.height))) continue;
      total++;
      const i = (y * png.width + x) * 4;
      const d = Math.abs(png.data[i] - 255) + png.data[i + 1] + Math.abs(png.data[i + 2] - 255);
      if (d > 24) {
        bad++;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  report(bad === 0, `${label}: ${bad} stale px of ${total} outside ${views.length} view(s)${bad ? ` (rows ${minY}-${maxY})` : ''}`);
  return views;
}

async function scrollTo(p, y) {
  await p.evaluate((y) => window.scrollTo(0, y), y);
  // Lenis owns the scroll: wheel through it as a visitor would, then settle
  await p.waitForTimeout(700);
}

const kinds = (v) => v.map((x) => x.kind).sort().join(',') || '(none)';

for (const W of widths) {
  const ctx = await b.newContext({ viewport: { width: W, height: Math.round(W * 0.496) }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1')); // J5: no opening strike in steady-state checks
  p.setDefaultTimeout(600000);
  for (const route of ['/', '/work/too-yumm']) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 }).catch(() => {});
    await p.waitForTimeout(1500);
    for (const y of [0, 300, 700, 1200, 0]) {
      await p.mouse.wheel(0, 0);
      await scrollTo(p, y);
      await check(p, `${W} ${route} scroll ${y}`);
    }
  }
  // open a project from the booth (the same path as a click on a sample), then walk routes
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 }).catch(() => {});
  await p.waitForTimeout(1000);
  await p.evaluate(() => (document.querySelector('.booth-focus__item[data-slug="too-yumm"]') || document.querySelector('a[href="/work/too-yumm"]'))?.click());
  await p.waitForURL('**/work/too-yumm');
  await p.waitForTimeout(2500);
  let v = await check(p, `${W} / → /work/too-yumm (opened from the booth)`);
  report(kinds(v) === 'stage', `${W} views on /work/too-yumm = ${kinds(v)} (expected stage)`);
  await p.evaluate(() => document.querySelector('a[href="/work/sonde"]')?.click() || window.next?.router?.push('/work/sonde'));
  // the soft navigation can take a while in software rendering: wait for it before falling back to a
  // load (a fallback that races it pushes a second history entry)
  await p.waitForURL('**/work/sonde', { timeout: 30000 }).catch(() => p.goto(BASE + '/work/sonde', { waitUntil: 'networkidle' }));
  await p.waitForTimeout(2500);
  await scrollTo(p, 900);
  v = await check(p, `${W} /work/sonde scrolled 900`);
  report(kinds(v) === 'stage', `${W} views on /work/sonde = ${kinds(v)} (expected stage)`);
  await p.goBack();
  await p.goBack();
  await p.waitForURL(BASE + '/');
  await p.waitForTimeout(2500);
  v = await check(p, `${W} back on /`);
  report(kinds(v) === 'stage', `${W} views on / = ${kinds(v)} (expected stage)`);
  await ctx.close();
}
// L7 (09B): the shelf (tall phone and tablet): scrolled down it and back, and the live resize and
// rotation sequence on one page: at every step the right arrangement and no stale pixel
if (!process.env.SKIP_SHAPES) {
  for (const [W, H] of [[393, 659], [1032, 1230]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 1100, hasTouch: W < 600 });
    const p = await ctx.newPage();
    await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
    p.setDefaultTimeout(600000);
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 }).catch(() => {});
    await p.waitForTimeout(1500);
    for (const y of [0, 400, 900, 1600, 0]) {
      await scrollTo(p, y);
      await check(p, `${W}x${H} / (shelf) scroll ${y}`);
    }
    await ctx.close();
  }
  const ctx = await b.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  p.setDefaultTimeout(900000);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]');
  await p.waitForTimeout(1500);
  const want = { '2560x1440': 'wide', '1376x940': 'wide', '1376x980': 'wide', '1032x1230': 'shelf3', '393x659': 'shelf2' };
  for (const [w, h] of [[1376, 940], [1032, 1230], [393, 659], [1032, 1230], [1376, 940], [2560, 1440], [1032, 1230], [1376, 980], [1032, 1230], [1376, 980]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.waitForFunction(([w, h]) => { const s = window.__boothShape?.(); return s && s.w === w && Math.abs(s.h - h) < 2; }, [w, h], { timeout: 300000, polling: 500 });
    await p.waitForFunction(() => !document.querySelector('.booth-cover') || document.querySelector('.booth-cover').hidden, null, { timeout: 300000, polling: 500 });
    await p.waitForTimeout(1500);
    const layout = await p.evaluate(() => document.documentElement.dataset.layout);
    report(layout === want[`${w}x${h}`], `resize → ${w}x${h}: arrangement ${layout} (want ${want[`${w}x${h}`]})`);
    await check(p, `resize → ${w}x${h}`);
  }
  await ctx.close();
}
await b.close();
console.log(fails ? `✗ ${fails} failure(s)` : '✓ no stale pixels, views match every route');
process.exit(fails ? 1 : 0);
