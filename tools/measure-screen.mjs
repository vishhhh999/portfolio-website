import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * G / L6: how bright the nearest objects read under SCREEN (the screens are the only light). On /,
 * after SCREEN has struck, the pouch (Too Yumm), the book (JSW Sports) and the SOOK boxes are
 * measured on the presented frame over the central 40% of each sample's on-screen box (the booth's
 * own focus rects): median CIE L* (D50) and mean relative luminance Y, as the loupe reads them.
 *
 *   BASE=http://localhost:3100 node tools/measure-screen.mjs [label]
 */
import { createRequire } from 'module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const label = process.argv[2] || BASE;
const b = await launch({ args: [] });
const p = await b.newPage({ viewport: { width: 1568, height: 980 } });
await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1')); // J5: no opening strike in steady-state checks
p.setDefaultTimeout(timeoutMs());
await p.goto(BASE + '/' + (process.env.Q || ''), { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: timeoutMs() });
await p.waitForTimeout(2000);
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '6' })));
await p.waitForTimeout(5000);
const rects = await p.evaluate(() =>
  Object.fromEntries(
    ['too-yumm', 'jsw-sports', 'sook'].map((s) => {
      const r = document.querySelector(`.booth-focus__item[data-slug="${s}"]`)?.getBoundingClientRect();
      return [s, r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null];
    }),
  ),
);
const { data, info } = await sharp(await p.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const Lstar = (Y) => (Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (24389 / 27) * Y);
const out = {};
for (const [slug, r] of Object.entries(rects)) {
  if (!r) continue;
  const Ls = [];
  let Ysum = 0;
  for (let y = Math.round(r.y + r.h * 0.3); y < r.y + r.h * 0.7; y++)
    for (let x = Math.round(r.x + r.w * 0.3); x < r.x + r.w * 0.7; x++) {
      const i = (y * info.width + x) * 3;
      const Y = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
      Ysum += Y;
      Ls.push(Lstar(Y));
    }
  Ls.sort((a, b) => a - b);
  out[slug] = { Lstar: +Ls[Ls.length >> 1].toFixed(1), Y: +((Ysum / Ls.length) * 100).toFixed(2) };
}
console.log(label, JSON.stringify(out));
await b.close();
