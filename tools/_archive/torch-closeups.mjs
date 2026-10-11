import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * C2: AFTER DARK over the case-study images. For each proof: the torch is held still over it and a
 * 100% crop is saved; then the same crop under D50 (the plain file). Inside the torch's flat core
 * the two must match (the multiplier is exactly 1.0: max channel difference ≤ 1, from rounding);
 * the falloff must be monotonic with no rings (luminance ratio AFTER DARK / D50 along a radius
 * never rises going outwards by more than dither).
 *
 *   node tools/torch-closeups.mjs → tools/lamp-review/torch/*.png
 */
import { createRequire } from 'module';
import sharp from 'sharp';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/torch/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const CASES = [['sonde', 2], ['too-yumm', 0], ['jsw-sports', 1]];
const b = await launch({ args: [] });
const ctx = await b.newContext({ viewport: { width: 1568, height: 980 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1')); // J5: no opening strike in steady-state checks
p.setDefaultTimeout(timeoutMs());
let fails = 0;
const key = (k) => p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), k);
for (const [slug, idx] of CASES) {
  // ?gpu=high: a software renderer is the low tier, where proofs stay plain DOM images (no torch planes)
  await p.goto(`${BASE}/work/${slug}?gpu=high`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: timeoutMs() });
  await key('1');
  const r0 = await p.evaluate((i) => {
    const el = document.querySelectorAll('.proof__image img, .proof__image video')[i];
    el.scrollIntoView({ block: 'center' });
    return true;
  }, idx);
  void r0;
  await p.waitForTimeout(1500);
  const r = await p.evaluate((i) => {
    const b = document.querySelectorAll('.proof__image img, .proof__image video')[i].getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
  }, idx);
  const clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.w, 1568 - r.x), height: Math.min(r.h, 980 - Math.max(0, r.y)) };
  const cx = clip.x + clip.width / 2, cy = clip.y + clip.height / 2;
  await p.mouse.move(cx, cy);
  const plain = await p.screenshot({ clip });
  await key('7');
  await p.waitForTimeout(500);
  await p.mouse.move(cx + 1, cy);
  await p.mouse.move(cx, cy);
  await p.waitForTimeout(2500); // the hand lamp settles on the pointer
  const torch = await p.screenshot({ clip });
  await sharp(torch).toFile(`${OUT}${slug}-${String(idx + 1).padStart(2, '0')}-afterdark.png`);
  await sharp(plain).toFile(`${OUT}${slug}-${String(idx + 1).padStart(2, '0')}-d50.png`);
  const A = await sharp(torch).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const D = await sharp(plain).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = A.info.width, h = A.info.height;
  const px = (buf, x, y) => {
    const i = (Math.round(y) * w + Math.round(x)) * 3;
    return [buf[i], buf[i + 1], buf[i + 2]];
  };
  // the torch core: radius 0.2·min(W,H)·(1−0.55) of the viewport, measured from the pointer
  const R = 0.2 * Math.min(1568, 980);
  const core = R * 0.45 * 0.8;
  let maxd = 0;
  for (let y = h / 2 - core; y < h / 2 + core; y += 3)
    for (let x = w / 2 - core; x < w / 2 + core; x += 3) {
      if (Math.hypot(x - w / 2, y - h / 2) > core || x < 0 || y < 0 || x >= w || y >= h) continue;
      const a = px(A.data, x, y), d = px(D.data, x, y);
      maxd = Math.max(maxd, ...a.map((v, k) => Math.abs(v - d[k])));
    }
  // falloff along four radii: AFTER DARK / D50 luminance ratio, binned per 4px
  const lum = ([r, g, bb]) => 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  let rises = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let prev = Infinity;
    for (let s = 0; s < R * 1.05; s += 6) {
      const x = w / 2 + dx * s, y = h / 2 + dy * s;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const dl = lum(px(D.data, x, y));
      if (dl < 25) continue; // too dark to read a ratio
      const ratio = lum(px(A.data, x, y)) / dl;
      if (ratio > prev + 0.04) rises++;
      prev = Math.min(prev, ratio);
    }
  }
  // the torch must really be there: outside its radius the image is dark (ratio to D50 well below 1)
  const outs = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = w / 2 + dx * R * 1.15, y = h / 2 + dy * R * 1.15;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const dl = lum(px(D.data, x, y));
    if (dl >= 25) outs.push(lum(px(A.data, x, y)) / dl);
  }
  const dark = outs.length ? Math.max(...outs) : null;
  const okDark = dark !== null && dark < 0.15;
  const okCore = maxd <= 1, okFall = rises === 0 && okDark;
  if (!okCore || !okFall) fails++;
  console.log(`${okCore && okFall ? 'PASS' : 'FAIL'} ${slug} proof ${idx + 1}: core matches the file (max channel diff ${maxd}), falloff ${rises ? `${rises} rise(s) (rings)` : 'monotonic, no rings'}, outside the torch ${dark === null ? 'not measurable' : `${(dark * 100).toFixed(1)}% of the file`}${okDark ? '' : ' (no torch drawn!)'}`);
}
await b.close();
process.exit(fails ? 1 : 0);
