/**
 * D1 / D5: layout edges.
 *  D1  the home booth: the cabinet's rendered left and right edges (its opaque silhouette, drawn in
 *      magenta with ?viewdebug=cabinet) are symmetric inside the booth frame to ±2px, and where the
 *      78svh height cap is not hit they reach the content gutters to ±4px. 725–2560 wide; at 390
 *      (the phone's portrait crop, panned sample to sample) the cabinet must cover the frame.
 *  D5  on /, /work/too-yumm and /archive at 1568 and 2560: the nav, the footer and the "Next on the
 *      tray" row end on the right content gutter (±2px).
 */
import { createRequire } from 'module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
const ok = (c, m) => {
  if (!c) fails++;
  console.log(`${c ? 'PASS' : 'FAIL'} ${m}`);
};
const HIDE = `html, body { background: #00ff00 !important; } body * { visibility: hidden !important; } .booth-canvas, .booth-canvas * { visibility: visible !important; }`;

for (const [W, H] of [[390, 844], [725, 960], [1024, 768], [1280, 800], [1568, 980], [1920, 1080], [2560, 1271]]) {
  const mobile = W < 700;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  await p.goto(BASE + '/?viewdebug=cabinet', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
  await p.waitForTimeout(1500);
  const f = await p.evaluate(() => {
    const r = document.querySelector('.booth-frame').getBoundingClientRect();
    const g = parseFloat(getComputedStyle(document.querySelector('.hero')).paddingLeft);
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, gutter: g, cw: document.documentElement.clientWidth, aspect: 1.57 / 0.965 };
  });
  const tag = await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(100);
  const { data, info } = await sharp(await p.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await tag.evaluate((n) => n.remove());
  // magenta columns inside the frame's rows
  let L = Infinity, R = -Infinity;
  for (let y = Math.max(0, Math.round(f.top)); y < Math.min(info.height, Math.round(f.bottom)); y += 2)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      // magenta under any tone curve (as tools/check-views.mjs): red and blue high and close, green well below
      if (data[i] > 120 && data[i + 2] > 120 && Math.abs(data[i] - data[i + 2]) < 40 && data[i + 1] < 0.7 * Math.min(data[i], data[i + 2])) {
        L = Math.min(L, x);
        R = Math.max(R, x + 1);
      }
    }
  if (mobile) {
    ok(L <= f.left + 1 && R >= f.right - 1, `${W}: portrait crop covers the frame (cabinet ${L}–${R}, frame ${f.left.toFixed(0)}–${f.right.toFixed(0)})`);
  } else {
    const dl = L - f.left, dr = f.right - R;
    ok(Math.abs(dl - dr) <= 2, `${W}: cabinet centred in the frame (left gap ${dl.toFixed(1)}px, right gap ${dr.toFixed(1)}px)`);
    const capped = f.height < f.width / f.aspect - 2;
    if (!capped) ok(Math.abs(L - f.gutter) <= 4 && Math.abs(R - (f.cw - f.gutter)) <= 4, `${W}: cabinet reaches the gutters (${L}–${R} vs ${f.gutter.toFixed(0)}–${(f.cw - f.gutter).toFixed(0)})`);
    else console.log(`     ${W}: height-capped (frame ${f.width.toFixed(0)}×${f.height.toFixed(0)}), centred instead`);
    ok(Math.abs(f.left - f.gutter) <= 2 && Math.abs(f.right - (f.cw - f.gutter)) <= 2, `${W}: booth stage spans gutter to gutter (${f.left.toFixed(0)}–${f.right.toFixed(0)})`);
  }
  await ctx.close();
}

for (const W of [1568, 2560]) {
  const ctx = await b.newContext({ viewport: { width: W, height: Math.round(W * 0.6) } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  for (const route of ['/', '/work/too-yumm', '/archive']) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const m = await p.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const g = parseFloat(getComputedStyle(document.querySelector('.masthead')).paddingLeft);
      const contentRight = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.right - parseFloat(getComputedStyle(el).paddingRight);
      };
      return {
        gutterRight: cw - g,
        nav: document.querySelector('.sitenav')?.getBoundingClientRect().right,
        footer: contentRight(document.querySelector('.footer')),
        footerLast: document.querySelector('.footer')?.lastElementChild?.getBoundingClientRect().right,
        nextRow: contentRight(document.querySelector('.work__links')),
        next: document.querySelector('.next')?.getBoundingClientRect().right ?? null,
      };
    });
    for (const k of ['nav', 'footer', 'footerLast', 'nextRow', 'next']) {
      if (m[k] == null) continue;
      ok(Math.abs(m[k] - m.gutterRight) <= 2, `${W} ${route} ${k} right edge ${m[k].toFixed(1)} = gutter ${m.gutterRight.toFixed(1)}`);
    }
  }
  await ctx.close();
}
await b.close();
console.log(fails ? `✗ ${fails} failure(s)` : '✓ layout edges hold');
process.exit(fails ? 1 : 0);
