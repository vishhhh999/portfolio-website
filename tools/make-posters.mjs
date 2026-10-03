/**
 * Renders the D50 lineup posters (the LCP image shown before WebGL boots) from
 * the live booth, so the crossfade to the canvas is pixel-matched.
 *   npm run build && npx next start -p 3100 &   then   node tools/make-posters.mjs && python3 tools/encode-posters.py
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('../public/booth/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, w, h] of [['16x10', 1440, 900], ['16x9', 1920, 1080], ['portrait', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: name === 'portrait' ? 2 : 1, reducedMotion: 'reduce' });
  await page.goto(BASE + '/?gpu=high', { waitUntil: 'networkidle' });
  await page.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: '.masthead,.hero,.panel,.footer,.booth-poster,.booth-stage::after{visibility:hidden!important;display:none!important}' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}poster-${name}.png` });
  console.log('poster', name);
  await page.close();
}
await browser.close();
