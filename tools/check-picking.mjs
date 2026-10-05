/**
 * B4: picking. On every booth route, a grid of points over the stage: what a click there would
 * open (the real event filter) must be what is actually seen there (the nearest solid surface).
 * Fails on any point that would open a sample you are not looking at (hidden, occluded, mostly
 * out of view, or empty space). Also reports how many points pick each sample.
 *   node tools/check-picking.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const SLUGS = ['too-yumm', 'jsw-sports', 'mitooshi', 'sonde', 'house-of-hex', 'bengal-t20', 'sook', 'shunya', 'indo-thai'];
const ROUTES = ['/', ...SLUGS.map((s) => `/work/${s}`)];
const SIZES = (process.env.SIZES || '1568x980,390x844').split(',').map((s) => s.split('x').map(Number));
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const [w, h] of SIZES) {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  p.setDefaultTimeout(240000);
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.waitForSelector('.booth-stage[data-ready="true"]');
    await p.waitForTimeout(1500);
    const res = await p.evaluate(() => {
      const r = document.querySelector('.booth-stage').getBoundingClientRect();
      const out = { n: 0, picks: {}, wrong: [] };
      const NX = 40, NY = 24;
      for (let i = 0; i < NX; i++)
        for (let j = 0; j < NY; j++) {
          const x = r.left + ((i + 0.5) / NX) * r.width, y = r.top + ((j + 0.5) / NY) * r.height;
          if (y < 0 || y > innerHeight) continue;
          const { pick, seen } = window.__boothPickAt(x, y);
          out.n++;
          if (pick) out.picks[pick] = (out.picks[pick] ?? 0) + 1;
          if (pick && pick !== seen) out.wrong.push(`${pick}@${Math.round(x)},${Math.round(y)} (seen ${seen ?? 'nothing'})`);
        }
      return out;
    });
    bad += res.wrong.length;
    console.log(`${w}x${h} ${route.padEnd(22)} ${res.n} points · picks ${JSON.stringify(res.picks)}${res.wrong.length ? `  WRONG ${res.wrong.length}: ${res.wrong.slice(0, 4).join('; ')}` : '  ok'}`);
  }
  await p.close();
}
await b.close();
console.log(bad ? `FAIL: ${bad} points would open something not seen there` : 'PASS: every pick is what is seen');
process.exit(bad ? 1 : 0);
