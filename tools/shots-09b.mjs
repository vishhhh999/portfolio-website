/**
 * L8 (09B): the delivery screenshots into tools/lamp-review/09b/shots/ (JPEG q86):
 *   / at every L7 viewport (width x svh height, first screen; the shelf also scrolled to its middle)
 *   /work/sook and /about at 390x664, 1032x1230, 1376x940, 1568x980
 *   node tools/shots-09b.mjs   (against a running build; slow in software)   ONLY=393x659 to limit
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/09b/shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const MATRIX = [[390, 664], [393, 659], [393, 852], [430, 932], [750, 393], [932, 430], [768, 1024], [820, 1180], [1032, 1230], [1032, 1260], [1376, 940], [1376, 980], [1180, 820], [1024, 1366], [1440, 900], [1568, 980], [1920, 1080], [2560, 1440], [1180, 1000]];
const PAGES = [[390, 664], [1032, 1230], [1376, 940], [1568, 980]];
const only = process.env.ONLY?.split(',');
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function shot(w, h, path, name, scrollMid = false) {
  const phone = w < 600;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    sessionStorage.setItem('vm:opened:v1', '1');
    sessionStorage.setItem('vm:hint:v1', '1');
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(900000);
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  if (await p.locator('.booth-stage').count()) await p.waitForSelector('.booth-stage[data-ready="true"]').catch(() => {});
  await p.waitForTimeout(3000);
  const save = async (suffix) => sharp(await p.screenshot()).jpeg({ quality: 86 }).toFile(`${OUT}${name}${suffix}.jpg`);
  await save('');
  if (scrollMid && (await p.evaluate(() => (document.documentElement.dataset.layout ?? '').startsWith('shelf')))) {
    const mid = await p.evaluate(() => {
      const f = document.querySelector('.booth-frame').getBoundingClientRect();
      return Math.max(0, f.top + scrollY + f.height / 2 - innerHeight / 2);
    });
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), mid);
    await p.waitForTimeout(3000);
    await save('-scrolled');
  }
  const meta = await p.evaluate(() => [document.documentElement.dataset.shape, document.documentElement.dataset.layout]);
  console.log(name, meta.join(' / '));
  await ctx.close();
}
for (const [w, h] of MATRIX.filter(([w, h]) => !only || only.includes(`${w}x${h}`))) await shot(w, h, '/', `home-${w}x${h}`, true);
for (const [w, h] of PAGES.filter(([w, h]) => !only || only.includes(`${w}x${h}`)))
  for (const path of ['/work/sook', '/about']) await shot(w, h, path, `${path.replace(/\W+/g, '-').slice(1)}-${w}x${h}`);
await b.close();
