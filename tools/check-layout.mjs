/**
 * C1 / C2 (07) and D5 (06): layout edges.
 *  C2  the home booth: one centred column. The cabinet's rendered left and right edges (its opaque
 *      silhouette, drawn in magenta with ?viewdebug=cabinet) are symmetric inside the booth frame to
 *      ±2px; the frame is centred on the page (±2px); its width is min(content width, cabinet aspect × the
 *      height left under the headline and above the panel); booth and panel fit in the first screen.
 *      390, 725, 1024, 1568, 1920 and 2560×1440; under 600px (the phone's own portrait shot, panned
 *      sample to sample) the cabinet must cover the frame.
 *  D5  on /, /work/too-yumm and /archive at 1568 and 2560: the nav and the footer end on the right
 *      content gutter (±2px), and the previous / next row spans the rail.
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

for (const [W, H] of [[390, 844], [725, 960], [1024, 768], [1568, 980], [1920, 1080], [2560, 1440]]) {
  const mobile = W < 600;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  await p.goto(BASE + '/?viewdebug=cabinet', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
  await p.waitForTimeout(1500);
  const f = await p.evaluate(() => {
    const r = document.querySelector('.booth-frame').getBoundingClientRect();
    const g = parseFloat(getComputedStyle(document.querySelector('.hero')).paddingLeft);
    const slot = document.getElementById('panel-slot')?.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, gutter: g, cw: document.documentElement.clientWidth, vh: innerHeight, panelBottom: slot?.bottom ?? 0, panelH: slot?.height ?? 0 };
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
    ok(Math.abs((f.left + f.right) / 2 - f.cw / 2) <= 2, `${W}: stage centred on the page (${f.left.toFixed(0)}–${f.right.toFixed(0)} of ${f.cw})`);
    const content = f.cw - 2 * f.gutter;
    const avail = f.vh - f.top - Math.max(56, f.panelH) - 14 - 18;
    const aspect = 1.57 / (0.8 + 0.045 + 0.055 + 0.02); // CABINET_FACE w / h (staging.ts)
    const want = Math.max(280, Math.min(content, aspect * avail));
    ok(Math.abs(f.width - want) <= 2 && Math.abs(f.width / f.height - aspect) < 0.01, `${W}: stage = min(content ${content.toFixed(0)}, ${aspect.toFixed(3)} × ${avail.toFixed(0)}) = ${want.toFixed(0)} (is ${f.width.toFixed(0)}×${f.height.toFixed(0)})`);
    ok(f.panelBottom <= f.vh + 1, `${W}: booth and panel in the first screen (panel ends at ${f.panelBottom.toFixed(0)} of ${f.vh})`);
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
        nextRow: contentRight(document.querySelector('.workend')),
        next: document.querySelector('.workend__card--next')?.getBoundingClientRect().right ?? null,
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
