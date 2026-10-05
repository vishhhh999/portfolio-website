/**
 * A2: no frame of the booth may present black or partly cleared. The pointer moves along a path
 * across the page for 3s (inside and outside the stage) while every presented frame's mean stage
 * luminance is recorded (window.__boothCapture, read straight after the frame is drawn). No frame
 * may drop more than 5% below the median of its neighbours (±3 frames). Under D50 and A.
 *
 *   node tools/check-flicker.mjs (with ?perf) [width=1568]
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const W = +(process.argv[2] || 1280), H = Math.round(W * 0.62);
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.setDefaultTimeout(600000);
let fails = 0;
await p.goto(BASE + '/?perf', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
await p.waitForTimeout(2000);
for (const [lamp, key] of [['D50', '1'], ['A', '3']]) {
  await p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), key);
  await p.waitForTimeout(3500); // past the strike
  await p.evaluate(() => (window.__boothCapture = { on: true, lums: [] }));
  // a path through the headline, across the booth, out to the right edge and back
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push([W * (0.05 + 0.9 * t), H * (0.15 + 0.7 * Math.abs(Math.sin(t * Math.PI * 2)))]);
  }
  const t0 = Date.now();
  for (const [x, y] of pts) {
    await p.mouse.move(x, y, { steps: 2 });
    await p.waitForTimeout(Math.max(0, 3000 / pts.length - 10));
  }
  const lums = await p.evaluate(() => {
    window.__boothCapture.on = false;
    return window.__boothCapture.lums;
  });
  let worst = 0, at = -1;
  for (let i = 0; i < lums.length; i++) {
    const nb = lums.slice(Math.max(0, i - 3), i).concat(lums.slice(i + 1, i + 4)).sort((a, b) => a - b);
    if (!nb.length) continue;
    const med = nb[Math.floor(nb.length / 2)];
    const drop = med > 0 ? (med - lums[i]) / med : 0;
    if (drop > worst) (worst = drop), (at = i);
  }
  const ok = lums.length > 5 && worst <= 0.05;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${lamp}: ${lums.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s, luminance ${Math.min(...lums).toFixed(1)}-${Math.max(...lums).toFixed(1)}, worst drop ${(worst * 100).toFixed(1)}%${at >= 0 ? ` at frame ${at}` : ''}`);
}
await b.close();
console.log(fails ? `✗ ${fails} failure(s)` : '✓ no dark frames');
process.exit(fails ? 1 : 0);
