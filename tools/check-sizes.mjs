/**
 * Projected width of every sample in the home lineup (object only, plinth excluded) as % of the
 * viewport width, measured through the live camera at common desktop sizes. Fails under 5%.
 *   node tools/check-sizes.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
for (const [w, h] of [[1440, 900], [1568, 980], [1920, 1080], [1366, 768]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 180000 });
  await p.waitForTimeout(800);
  const sizes = await p.evaluate(() => window.__boothSizes());
  const min = Math.min(...Object.values(sizes));
  if (min < 5) ok = false;
  console.log(`${w}x${h}`, Object.entries(sizes).map(([k, v]) => `${k} ${v}%`).join('  '), min < 5 ? '  < 5% !' : '');
  await p.close();
}
await b.close();
process.exit(ok ? 0 : 1);
