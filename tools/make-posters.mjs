import { launch } from './lib/browser.mjs';
/**
 * The booth's first frames: what a page shows before the live canvas is ready (it then crossfades,
 * with no jump, because the canvas draws the same camera into the same box). Run on demand, after a
 * change to the booth's composition, lights or camera, against a running production build:
 *   node tools/make-posters.mjs            home + every project, wide and tall
 *   ONLY=home,sonde node tools/make-posters.mjs
 *   SCALE=2 (default 2 on GL=gpu, 1 in software)
 * Writes public/booth/poster-<home|slug>-<wide|tall>.webp.
 */
import { readdirSync } from 'node:fs';
import sharp from 'sharp';

const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('../public/booth/', import.meta.url).pathname;
const SCALE = Number(process.env.SCALE || (process.env.GL === 'gpu' ? 2 : 1));
const slugs = readdirSync(new URL('../public/models/', import.meta.url));
const only = process.env.ONLY?.split(',');
const jobs = ['home', ...slugs].filter((n) => !only || only.includes(n));
const browser = await launch();
for (const [shape, vp] of [['wide', { width: 1568, height: 980 }], ['tall', { width: 393, height: 852 }]]) {
  const phone = shape === 'tall';
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: phone ? Math.max(2, SCALE) : SCALE, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
  for (const name of jobs) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${name === 'home' ? '/' : `/work/${name}`}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-booth-ready'), null, { timeout: 300_000 });
    await page.addStyleTag({ content: '.booth-links, .booth-poster { display: none !important; }' });
    await page.waitForTimeout(process.env.GL === 'gpu' ? 800 : 3000);
    const el = await page.$(name === 'home' ? '.booth-frame' : '.work-stage__view');
    const png = await el.screenshot({ type: 'png' });
    await sharp(png).webp({ quality: 80, effort: 6 }).toFile(`${OUT}poster-${name}-${shape}.webp`);
    console.log(`poster-${name}-${shape}.webp`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
