/**
 * C1 (08): the poster is the live booth. On / at 1568x980 (and the phone at 390x844), the cabinet
 * frame is captured live (poster hidden) and compared with the poster the page would show there,
 * scaled to the same size: mean absolute difference per channel. Fails above THRESHOLD (2.5%), so a
 * stale poster (an old layout, an old object, a colour checker that is gone) cannot pass.
 *   node tools/check-poster.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const PUB = new URL('../public/', import.meta.url).pathname;
const THRESHOLD = 2.5;
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
// the repeat-visit posters, and the first-visit (dark) posters against the booth with the opening strike held at 0
for (const [w, h, dpr, mobile, file, dark] of [[1568, 980, 1, false, 'booth/poster-cabinet-2400.webp'], [390, 844, 2, true, 'booth/poster-phone.webp'], [1568, 980, 1, false, 'booth/poster-cabinet-dark-2400.webp', true], [390, 844, 2, true, 'booth/poster-phone-dark.webp', true]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: dark ? 'no-preference' : 'reduce' });
  p.setDefaultTimeout(900000);
  if (dark) await p.addInitScript(() => (window.__boothStrikeHold = 0));
  else await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await p.goto(BASE + '/?gpu=high', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]');
  // the poster the page actually shows here (its <picture> picks by viewport)
  const shown = dark ? '' : await p.evaluate(() => document.querySelector('.booth-poster img')?.currentSrc ?? '');
  await p.addStyleTag({ content: '.booth-poster,.masthead,.hero__copy,.panel-slot,.footer,.booth-swipe,.booth-focus,.specchip{visibility:hidden!important}' });
  await p.waitForTimeout(4000);
  const r = await p.locator('.booth-frame').boundingBox();
  const live = await sharp(await p.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: r.height }, timeout: 900000 })).flatten({ background: '#f2f0ea' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await p.close();
  const posterFile = shown ? PUB + new URL(shown).pathname.slice(1) : PUB + file;
  const poster = await sharp(readFileSync(posterFile)).resize(live.info.width, live.info.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < poster.length; i++) sum += Math.abs(poster[i] - live.data[i]);
  const diff = (sum / poster.length / 255) * 100;
  const ok = diff <= THRESHOLD;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${w}x${h}${dark ? ' first visit' : ''}: poster ${posterFile.replace(PUB, '/')} vs live cabinet: mean difference ${diff.toFixed(2)}% (limit ${THRESHOLD}%)`);
}
await b.close();
process.exit(fails ? 1 : 0);
