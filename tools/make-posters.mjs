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
for (const [name, w, h] of [['16x10', 1440, 900], ['16x9', 1920, 1080], ['portrait', 390, 844]].filter(([n]) => !process.argv[2] || process.argv[2].split(',').includes(n))) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: name === 'portrait' ? 2 : 1, reducedMotion: 'reduce' });
  page.setDefaultTimeout(600000);
  await page.goto(BASE + '/?gpu=high', { waitUntil: 'networkidle' });
  await page.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
  await page.waitForTimeout(4000);
  // keep the layout (the camera frames the cabinet into .booth-frame): hide the copy, don't remove it
  await page.addStyleTag({ content: '.masthead,.hero__copy,.panel,.footer,.booth-poster,.booth-swipe,.booth-focus,.booth-stage::after{visibility:hidden!important}' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}poster-${name}.png` });
  console.log('poster', name);
  await page.close();
}
await browser.close();
