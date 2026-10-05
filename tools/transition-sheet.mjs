/**
 * A4: the booth → project transition, frame by frame. The page runs on Playwright's virtual clock
 * (so software rendering keeps true time): the sample is opened from the booth, then the clock
 * advances one 60Hz frame at a time and each presented frame is captured. 12 frames, evenly over
 * the first ~0.9s, are laid out as a contact sheet with their times.
 *
 *   node tools/transition-sheet.mjs [slug=too-yumm] [out=tools/lamp-review/transition-sheet.png]
 */
import { createRequire } from 'module';
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const slug = process.argv[2] || 'too-yumm';
const out = process.argv[3] || new URL('./lamp-review/transition-sheet.png', import.meta.url).pathname;
mkdirSync(dirname(out), { recursive: true });
const W = 1568, H = 980;
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1')); // J5: no opening strike in steady-state checks
p.setDefaultTimeout(600000);
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
await p.waitForTimeout(2500);
// warm the route so the frames show the transition, not the network
await p.evaluate((s) => fetch(`/work/${s}`).catch(() => {}), slug);
await p.clock.install();
await p.clock.pauseAt(Date.now() + 1000);
// let the booth settle on the virtual clock first, so the first frames after the click have true 60Hz deltas
for (let i = 0; i < 20; i++) await p.clock.runFor(1000 / 60);
const frames = [];
const STEP = 1000 / 60;
await p.evaluate((s) => document.querySelector(`.booth-focus__item[data-slug="${s}"]`)?.click(), slug);
for (let i = 0; i < 54; i++) {
  await p.clock.runFor(STEP);
  if (i % 4 === 1 && frames.length < 12) frames.push({ t: Math.round((i + 1) * STEP), png: await p.screenshot() });
  else if (i % 4 === 1) break;
}
await b.close();
const tw = 520, th = Math.round((tw * H) / W), pad = 14, cols = 4, rows = 3;
const sheet = sharp({ create: { width: cols * tw + (cols + 1) * pad, height: rows * (th + 26) + (rows + 1) * pad, channels: 3, background: '#f2f0ea' } });
const parts = [];
for (const [k, f] of frames.entries()) {
  const x = pad + (k % cols) * (tw + pad), y = pad + Math.floor(k / cols) * (th + 26 + pad);
  parts.push({ input: await sharp(f.png).resize(tw, th).png().toBuffer(), left: x, top: y + 26 });
  const label = Buffer.from(`<svg width="${tw}" height="22"><text x="0" y="16" font-family="monospace" font-size="15" fill="#111">FRAME ${String(k + 1).padStart(2, '0')} · ${f.t}MS AFTER CLICK</text></svg>`);
  parts.push({ input: label, left: x, top: y });
}
await sheet.composite(parts).png().toFile(out);
console.log(`${out}: ${frames.length} frames`);
