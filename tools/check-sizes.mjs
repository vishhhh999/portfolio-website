/**
 * Projected long side of every sample in the home lineup (object only, plinth excluded: its width,
 * or its height for a portrait piece) as % of the cabinet's projected width, measured through the
 * live camera. Fails under 11%, or under 9% for a sample on a raised plinth with nothing taller in
 * front (E 08: one display scale; staging.ts sizeFloor). F1 (desktop
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
for (const [w, h] of [[1440, 900], [1568, 980], [2560, 1271], [1920, 1080], [1366, 768], [725, 960], [390, 844], [430, 932]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 180000 });
  await p.waitForTimeout(800);
  const sizes = await p.evaluate(() => window.__boothSizes());
  const floors = await p.evaluate(() => window.__boothSizeFloors());
  const under = Object.entries(sizes).filter(([k, v]) => v < floors[k]);
  if (under.length) ok = false;
  console.log(`${w}x${h}`, Object.entries(sizes).map(([k, v]) => `${k} ${v}%${floors[k] < MIN ? ' (raised: 9)' : ''}`).join('  '), under.length ? `  under: ${under.map(([k]) => k).join(', ')} !` : '');
  if (w >= 700 || w < 600) {
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
    // G (08): phones: the arrangement is at 0.68 scale, so 5cm clear; and every object wholly in the box
    const phone = w < 600;
    let outside = [];
    if (phone) {
      const f = await p.evaluate(() => JSON.parse(JSON.stringify(document.querySelector('.booth-frame').getBoundingClientRect())));
      outside = Object.entries(boxes).filter(([, r]) => r.x0 < f.left || r.x1 > f.right || r.y0 < f.top || r.y1 > f.bottom).map(([k]) => k);
      if (outside.length) console.log(`   out of the frame: ${outside.join(', ')} !`);
    }
    const bad = worst.pct > 3 || minGap.m < (phone ? 0.05 : 0.08) || outside.length > 0;
    if (bad && (w === 1568 || w === 2560 || w < 600)) ok = false;
    console.log(`   overlap ${worst.pct.toFixed(1)}%${worst.a ? ` (${worst.a} / ${worst.b})` : ''} · min gap ${(minGap.m * 100).toFixed(1)}cm (${minGap.a} / ${minGap.b})${bad ? '  !' : ''}`);
  }
  await p.close();
}
await b.close();
process.exit(ok ? 0 : 1);
