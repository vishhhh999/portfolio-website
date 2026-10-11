import { launch } from './lib/browser.mjs';
/**
 * Review screenshots: the five key pages at four viewports, plus the home booth under all seven lamps.
 *   node tools/shots.mjs [outDir]       default review/latest
 *   ONLY=home,too-yumm  VIEWPORTS=1568x980,393x852  LAMPS=0 to narrow a run.
 * Software WebGL (the default): device scale 1 and canvases no wider than 1280 (the 2560 viewport is skipped).
 * GL=gpu: full device scale. Writes <out>/<page>-<w>x<h>.png, <out>/lamp-<n>-<name>.png and <out>/sheet.jpg.
 */
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL(`../${process.argv[2] || 'review/latest'}/`, import.meta.url).pathname;
const GPU = process.env.GL === 'gpu';
const WAIT = GPU ? 60_000 : 300_000;
mkdirSync(OUT, { recursive: true });

const PAGES = [['home', '/'], ['too-yumm', '/work/too-yumm'], ['sonde', '/work/sonde'], ['about', '/about'], ['archive', '/archive']];
const VIEWPORTS = [
  { w: 1568, h: 980 },
  { w: 2560, h: 1440 },
  { w: 1032, h: 1230 },
  { w: 393, h: 852, phone: true },
];
const LAMPS = ['d50', 'tl84', 'a', 'uv', 'flood', 'screen', 'afterdark'];
const only = process.env.ONLY?.split(',');
const onlyVp = process.env.VIEWPORTS?.split(',');

const browser = await launch();
const written = [];

async function open(vp, path, lampKey) {
  const scale = GPU ? (vp.phone ? 3 : 1) : 1;
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: scale, isMobile: !!vp.phone, hasTouch: !!vp.phone,
  });
  await ctx.addInitScript(() => {
    sessionStorage.setItem('vm:opened:v1', '1');
    sessionStorage.setItem('vm:hint:v1', '1');
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(WAIT);
  await page.goto(BASE + path, { waitUntil: 'load' });
  if (await page.locator('.booth-frame, .work-stage').count()) {
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-booth-ready'), null, { timeout: WAIT }).catch(() => console.warn(`  not ready: ${path} ${vp.w}x${vp.h}`));
  }
  if (lampKey) {
    await page.keyboard.press(lampKey);
    await page.waitForTimeout(GPU ? 1500 : 6000);
  }
  await page.waitForTimeout(GPU ? 1000 : 4000);
  return { ctx, page };
}

for (const vp of VIEWPORTS) {
  if (!GPU && vp.w > 1280 && vp.w !== 1568) continue;
  if (onlyVp && !onlyVp.includes(`${vp.w}x${vp.h}`)) continue;
  for (const [name, path] of PAGES) {
    if (only && !only.includes(name)) continue;
    const t = Date.now();
    const { ctx, page } = await open(vp, path);
    const file = `${OUT}${name}-${vp.w}x${vp.h}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
    written.push(file);
    console.log(`${name} ${vp.w}x${vp.h} ${((Date.now() - t) / 1000).toFixed(0)}s`);
    await ctx.close();
  }
}

if (process.env.LAMPS !== '0') {
  for (const [i, lamp] of LAMPS.entries()) {
    const { ctx, page } = await open({ w: 1568, h: 980 }, '/', String(i + 1));
    const file = `${OUT}lamp-${i + 1}-${lamp}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
    written.push(file);
    console.log(`lamp ${lamp}`);
    await ctx.close();
  }
}
await browser.close();

// Contact sheet: every capture scaled into a 480px wide cell, in order, labelled by file name.
const cell = 480;
const tiles = await Promise.all(written.map(async (file) => {
  const img = sharp(file).resize({ width: cell, height: 520, fit: 'contain', background: '#1a1a1a' });
  const label = Buffer.from(`<svg width="${cell}" height="24"><rect width="100%" height="100%" fill="#111"/><text x="8" y="17" font-family="monospace" font-size="13" fill="#ddd">${file.split('/').pop()}</text></svg>`);
  return sharp({ create: { width: cell, height: 544, channels: 3, background: '#1a1a1a' } })
    .composite([{ input: await img.png().toBuffer(), top: 24, left: 0 }, { input: label, top: 0, left: 0 }]).png().toBuffer();
}));
const cols = 5;
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * cell, height: rows * 544, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * cell, top: Math.floor(i / cols) * 544 })))
  .jpeg({ quality: 82 }).toFile(`${OUT}sheet.jpg`);
console.log(`${written.length} captures, sheet at ${OUT}sheet.jpg`);
