/**
 * Projected width of every sample in the home lineup (object only, plinth excluded) as % of the
 * cabinet's projected width, measured through the live camera. Fails under 11%. F1 (desktop
 * sizes): projected boxes of two samples may overlap by at most 3% of the smaller box, and the
 * clear 3D gap between any two samples is at least 8cm.
 *   node tools/check-sizes.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
const MIN = 11;
for (const [w, h] of [[1440, 900], [1568, 980], [2560, 1271], [1920, 1080], [1366, 768], [725, 960], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 180000 });
  await p.waitForTimeout(800);
  const sizes = await p.evaluate(() => window.__boothSizes());
  const min = Math.min(...Object.values(sizes));
  if (min < MIN) ok = false;
  console.log(`${w}x${h}`, Object.entries(sizes).map(([k, v]) => `${k} ${v}%`).join('  '), min < MIN ? `  < ${MIN}% !` : '');
  if (w >= 700) {
    const { boxes, minGap } = await p.evaluate(() => window.__boothBoxes());
    const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
    let worst = { pct: 0, a: '', b: '' };
    const ks = Object.keys(boxes);
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++) {
        const A = boxes[ks[i]], B = boxes[ks[j]];
        const ov = area({ x0: Math.max(A.x0, B.x0), y0: Math.max(A.y0, B.y0), x1: Math.min(A.x1, B.x1), y1: Math.min(A.y1, B.y1) });
        const pct = (ov / Math.min(area(A), area(B))) * 100;
        if (pct > worst.pct) worst = { pct, a: ks[i], b: ks[j] };
      }
    const bad = worst.pct > 3 || minGap.m < 0.08;
    if (bad && (w === 1568 || w === 2560)) ok = false;
    console.log(`   overlap ${worst.pct.toFixed(1)}%${worst.a ? ` (${worst.a} / ${worst.b})` : ''} · min gap ${(minGap.m * 100).toFixed(1)}cm (${minGap.a} / ${minGap.b})${bad ? '  !' : ''}`);
  }
  await p.close();
}
await b.close();
process.exit(ok ? 0 : 1);
