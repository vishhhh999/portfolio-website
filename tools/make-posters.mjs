/**
 * C1 (08): renders the LCP posters from the live booth: the cabinet's own frame box, cropped exactly,
 * so the poster sits in .booth-frame at any viewport and the 300ms crossfade to the canvas never
 * jumps. Desktop: one shot at the cabinet aspect (1200 and 2400 wide). Phone: the 4:5 phone staging.
 * C (08, first visit): the same shots with the tubes off (poster-*-dark), shown on a session's first
 * visit, when the booth comes up dark and the D50 tubes strike.
 * Records the inputs' hash (tools/poster-hash.mjs) in public/booth/posters.json.
 *   npm run build && npx next start -p 3100 &   then   node tools/make-posters.mjs
 */
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { posterFileHashes, posterHash } from './poster-hash.mjs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('../public/booth/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const HIDE = '.booth-poster,.masthead,.hero__copy,.panel-slot,.footer,.booth-swipe,.booth-focus,.specchip{visibility:hidden!important}';
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function capture(w, h, dpr, mobile, dark = false) {
  // dark: the first visit of a session, the booth's own first frame with the tubes off (the opening
  // strike held at 0), shown as the poster on that visit so the strike starts from what was already there
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: dark ? 'no-preference' : 'reduce' });
  page.setDefaultTimeout(900000);
  if (dark) await page.addInitScript(() => (window.__boothStrikeHold = 0));
  else await page.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await page.goto(BASE + '/?gpu=high', { waitUntil: 'networkidle' });
  await page.waitForSelector('.booth-stage[data-ready="true"]');
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(4000);
  const r = await page.locator('.booth-frame').boundingBox();
  const png = await page.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: r.height }, timeout: 900000 });
  await page.close();
  return png;
}
// the paper colour behind the cabinet (the frame box shows the page around the cabinet's shadow)
const flat = (buf) => sharp(buf).flatten({ background: '#f2f0ea' });
// DARK_ONLY=1 re-renders only the first-visit posters
if (!process.env.DARK_ONLY) {
  const desk = await capture(1568, 980, 2, false);
  for (const w of [1200, 2400]) await flat(desk).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-cabinet-${w}.webp`);
  await flat(desk).resize({ width: 1200 }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(`${OUT}poster-cabinet-1200.jpg`);
  const phone = await capture(390, 844, 2, true);
  await flat(phone).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-phone.webp`);
}
const deskDark = await capture(1568, 980, 2, false, true);
for (const w of [1200, 2400]) await flat(deskDark).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-cabinet-dark-${w}.webp`);
const phoneDark = await capture(390, 844, 2, true, true);
await flat(phoneDark).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-phone-dark.webp`);
await browser.close();
const hash = posterHash();
writeFileSync(`${OUT}posters.json`, JSON.stringify({ hash, files: posterFileHashes(), rendered: new Date().toISOString() }, null, 2) + '\n');
console.log('posters written', hash.slice(0, 12));
