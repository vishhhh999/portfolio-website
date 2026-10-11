import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * F4 (08): every model's textures at tray zoom: the tray shot of each project at 2560x1440, cropped
 * to the stage, into tools/lamp-review/08/tray-zoom/<slug>.jpg (focus pass off, so nothing is softened).
 *   node tools/tray-zoom.mjs [slug…]   (against a running build)
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/08/tray-zoom/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ['too-yumm', 'bengal-t20', 'sook', 'shunya', 'house-of-hex', 'mitooshi', 'indo-thai', 'sonde', 'jsw-sports'];
const b = await launch({ args: [] });
for (const slug of slugs) {
  const p = await b.newPage({ viewport: { width: 2560, height: 1440 } });
  p.setDefaultTimeout(timeoutMs());
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await p.goto(`${BASE}/work/${slug}?gpu=high&perf&no=focus`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]');
  await p.evaluate(() => {
    window.__boothAnimHold = 1;
    window.dispatchEvent(new Event('resize'));
  });
  await p.waitForTimeout(5000);
  const r = await p.locator('.booth-stage').boundingBox();
  const png = await p.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: r.height } });
  await sharp(png).jpeg({ quality: 90 }).toFile(`${OUT}${slug}.jpg`);
  console.log(slug);
  await p.close();
}
await b.close();
