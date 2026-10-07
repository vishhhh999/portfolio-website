/**
 * C1 (08): renders the LCP posters from the live booth: the cabinet's own frame box, cropped exactly,
 * so the poster sits in .booth-frame at any viewport and the 300ms crossfade to the canvas never
 * jumps. Desktop: one shot at the cabinet aspect (1200 and 2400 wide). Phone: the 4:5 phone staging.
 * C (08, first visit): the same shots with the tubes off (poster-*-dark), shown on a session's first
 * visit, when the booth comes up dark and the D50 tubes strike.
 * P2 (09): each project header's tray poster (public/booth/tray/<slug>[-phone].webp) and M1 the share
 * cards (public/og/<slug>.jpg from the tray shot, public/og/site.jpg from the cabinet poster).
 * Records the inputs' hash (tools/poster-hash.mjs) in public/booth/posters.json.
 *   npm run build && npx next start -p 3100 &   then   node tools/make-posters.mjs
 */
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
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
// P2 (09): each project header's poster, its tray shot lit by D50 (the JSW book held open), desktop
// 1568x980 and phone 390x844, cropped to the header stage; M1: the same shot is the base of the
// project's 1200x630 share card (project name in Geist), and the cabinet poster of the site's card
const TRAY = TRAY_SLUGS();
function TRAY_SLUGS() {
  return (process.env.TRAY ?? 'too-yumm,jsw-sports,mitooshi,sonde,house-of-hex,bengal-t20,sook,shunya,indo-thai').split(',').filter(Boolean);
}
mkdirSync(`${OUT}tray`, { recursive: true });
const OG = new URL('../public/og/', import.meta.url).pathname;
mkdirSync(OG, { recursive: true });
async function trayCapture(slug, w, h, dpr, mobile) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  page.setDefaultTimeout(900000);
  await page.addInitScript(() => {
    sessionStorage.setItem('vm:opened:v1', '1');
    window.__boothAnimHold = 1; // the JSW book open, as it settles on the tray
  });
  await page.goto(`${BASE}/work/${slug}?gpu=high`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.booth-stage[data-ready="true"]');
  await page.addStyleTag({ content: '.booth-poster,.panel,.masthead,.specchip,.booth-stage::after{visibility:hidden!important}' });
  await page.waitForTimeout(5000);
  const r = await page.locator('.booth-stage').boundingBox();
  const meta = await page.evaluate(() => ({
    title: document.querySelector('.work__head h1')?.textContent?.trim() ?? '',
    disciplines: [...document.querySelectorAll('.calib__rows div')].find((d) => d.querySelector('dt')?.textContent?.trim() === 'Disciplines')?.querySelector('dd')?.textContent?.trim() ?? '',
    year: [...document.querySelectorAll('.calib__rows div')].find((d) => d.querySelector('dt')?.textContent?.trim() === 'Year')?.querySelector('dd')?.textContent?.trim() ?? '',
  }));
  const png = await page.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, h - r.y) }, timeout: 900000 });
  await page.close();
  return { png, meta };
}
const fontData = (f) => readFileSync(new URL(`../app/fonts/${f}`, import.meta.url)).toString('base64');
async function shareCard(imgBuf, title, line, out) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const img = (await sharp(imgBuf).webp({ quality: 90 }).toBuffer()).toString('base64');
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: G; src: url(data:font/woff2;base64,${fontData('geist-sans-subset.woff2')}) format('woff2'); font-weight: 100 900; }
    @font-face { font-family: M; src: url(data:font/woff2;base64,${fontData('geist-mono-subset.woff2')}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; width: 1200px; height: 630px; background: #f2f0ea; color: #111; overflow: hidden; }
    .shot { position: absolute; left: 0; top: 0; width: 1200px; height: 486px; background: url(data:image/webp;base64,${img}) center / cover no-repeat; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 144px; border-top: 2px solid #111; display: flex; align-items: center; justify-content: space-between; padding: 0 48px; box-sizing: border-box; }
    h1 { font: 600 58px/1 G; letter-spacing: -0.035em; margin: 0; }
    .meta { font: 500 17px/1.6 M; letter-spacing: 0.08em; text-transform: uppercase; text-align: right; }
    .meta span { display: block; opacity: 0.6; }
  </style></head><body><div class="shot"></div><div class="bar"><h1>${title}</h1><div class="meta">${line}<span>Vishesh Mahendru</span></div></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
  await page.close();
}
for (const slug of TRAY) {
  const desk = await trayCapture(slug, 1568, 980, 1, false);
  await flat(desk.png).webp({ quality: 80, effort: 6 }).toFile(`${OUT}tray/${slug}.webp`);
  const phone = await trayCapture(slug, 390, 844, 2, true);
  await flat(phone.png).webp({ quality: 78, effort: 6 }).toFile(`${OUT}tray/${slug}-phone.webp`);
  await shareCard(desk.png, desk.meta.title, `${desk.meta.disciplines} · ${desk.meta.year}`, `${OG}${slug}.jpg`);
  console.log('tray poster + share card', slug);
}
if (!process.env.DARK_ONLY && !process.env.TRAY_ONLY) {
  await shareCard(readFileSync(`${OUT}poster-cabinet-2400.webp`), 'Tested under every light.', 'Brand and digital design · India', `${OG}site.jpg`);
  console.log('share card site');
}
if (!process.env.TRAY_ONLY) {
  const deskDark = await capture(1568, 980, 2, false, true);
  for (const w of [1200, 2400]) await flat(deskDark).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-cabinet-dark-${w}.webp`);
  const phoneDark = await capture(390, 844, 2, true, true);
  await flat(phoneDark).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-phone-dark.webp`);
}
await browser.close();
const hash = posterHash();
writeFileSync(`${OUT}posters.json`, JSON.stringify({ hash, files: posterFileHashes(), rendered: new Date().toISOString() }, null, 2) + '\n');
console.log('posters written', hash.slice(0, 12));
