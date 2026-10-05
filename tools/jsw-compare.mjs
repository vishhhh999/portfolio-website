/**
 * F3 (08): the JSW book open on the tray at 2560x1440, cropped to the book, against the Blender
 * reference (assets-src/models/jsw-sports/jsw-sports.ref-open.png).
 *   node tools/jsw-compare.mjs <out.png>          one crop from the running build
 *   node tools/jsw-compare.mjs --sheet a.png b.png → tools/lamp-review/08/jsw-compare.jpg
 *     (07 encoding · 08 encoding · reference, at the same height)
 */
import { createRequire } from 'module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
if (process.argv[2] === '--sheet') {
  const [a, b] = process.argv.slice(3);
  const H = 900;
  const ref = await sharp(`${ROOT}assets-src/models/jsw-sports/jsw-sports.ref-open.png`).trim().resize({ height: H }).toBuffer();
  const parts = await Promise.all([a, b].map((f) => sharp(f).resize({ height: H }).toBuffer()));
  const all = [...parts, ref];
  const metas = await Promise.all(all.map((x) => sharp(x).metadata()));
  const W = metas.reduce((s, m) => s + m.width + 16, -16);
  let x = 0;
  const comp = all.map((input, i) => {
    const o = { input, left: x, top: 0 };
    x += metas[i].width + 16;
    return o;
  });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comp).jpeg({ quality: 90 }).toFile(`${ROOT}tools/lamp-review/08/jsw-compare.jpg`);
  console.log('jsw-compare.jpg: 07 UASTC+RDO 1536 · 08 WebP 2048 · Blender reference');
  process.exit(0);
}
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 2560, height: 1440 } });
p.setDefaultTimeout(900000);
await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
await p.goto(BASE + '/work/jsw-sports?gpu=high&perf&no=focus', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]');
// the open clip held fully open (software rendering advances it ≤ 0.1s per frame); a resize redraws
await p.evaluate(() => {
  window.__boothAnimHold = 1;
  window.dispatchEvent(new Event('resize'));
});
await p.waitForTimeout(6000);
const r = await p.locator('.booth-stage').boundingBox();
// the open book sits in the middle of the tray shot
const clip = { x: r.x + r.width * 0.2, y: r.y + r.height * 0.12, width: r.width * 0.6, height: r.height * 0.76 };
await p.screenshot({ path: process.argv[2], clip });
await b.close();
console.log('crop', process.argv[2]);
