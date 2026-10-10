import { launch, timeoutMs, waitForBoothSettled, settleAfterReady } from './lib/browser.mjs';
/**
 * C1 (08): the poster is the live booth. L6 (09B): at every shape's check viewports
 * (tools/poster-matrix.mjs) the frame is captured live (poster hidden) and compared with the poster
 * the page picked there (which must be that shape's),
 * scaled to the same size: mean absolute difference per channel. Fails above THRESHOLD (2.5%), so a
 * stale poster (an old layout, an old object, a colour checker that is gone) cannot pass.
 *   node tools/check-poster.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';
import { HIDE_HOME, HIDE_TRAY, HOME, SLUGS, TRAY } from './poster-matrix.mjs';
import { GROUP_NAMES } from './poster-hash.mjs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const PUB = new URL('../public/', import.meta.url).pathname;
const THRESHOLD = 2.5;
const b = await launch({ args: [] });
let fails = 0;
/** Mean absolute difference per channel (%), the poster scaled to the live capture's width (L6 09B: a
 *  shelf poster is its first screen, so only its top part, as tall as the live capture, is compared). */
// L6 (09B): compared at a fixed 480px analysis width, so the film grain and edge antialiasing (which
// differ frame to frame and between pixel ratios) cancel out and a stale layout or object still fails
const ANALYSIS_W = 480;
async function compare(liveBuf, posterFile) {
  const lm = await sharp(liveBuf).metadata();
  const live = await sharp(liveBuf).flatten({ background: '#f2f0ea' }).resize(ANALYSIS_W, Math.round((lm.height * ANALYSIS_W) / lm.width), { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const meta = await sharp(readFileSync(posterFile)).metadata();
  const scaledH = Math.round((meta.height * live.info.width) / meta.width);
  let img = sharp(readFileSync(posterFile)).flatten({ background: '#f2f0ea' }).resize(live.info.width, scaledH, { fit: 'fill' });
  if (scaledH >= live.info.height) img = sharp(await img.png().toBuffer()).extract({ left: 0, top: 0, width: live.info.width, height: live.info.height });
  else img = img.resize(live.info.width, live.info.height, { fit: 'fill' });
  const poster = await img.removeAlpha().raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < poster.length; i++) sum += Math.abs(poster[i] - live.data[i]);
  return (sum / poster.length / 255) * 100;
}
// the repeat-visit posters, and the first-visit (dark) posters against the booth with the opening strike held at 0
const groups = process.env.CHECK_GROUPS?.split(',').filter(Boolean);
if (groups?.some((name) => !GROUP_NAMES.includes(name))) throw new Error('Unknown CHECK_GROUPS entry: ' + groups.filter((name) => !GROUP_NAMES.includes(name)).join(', '));
const only = process.env.ONLY_HOME?.split(',');
for (const entry of HOME.filter((e) => (!only || only.includes(e.name)) && (!groups || groups.includes(e.name))))
  for (const [w, h, dpr, mobile] of entry.check)
    for (const dark of [false, true]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: dark ? 'no-preference' : 'reduce' });
      p.setDefaultTimeout(timeoutMs());
      if (dark) await p.addInitScript(() => (window.__boothStrikeHold = 0));
      else await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
      await p.goto(BASE + '/?gpu=high', { waitUntil: 'networkidle' });
      await p.waitForSelector('.booth-stage[data-ready="true"]');
      await waitForBoothSettled(p, 'poster booth readiness');
      // the poster the page actually picked here (the boot script, by shape)
      const picked = await p.evaluate(() => document.documentElement.getAttribute('data-poster'));
      const shown = dark ? '' : await p.evaluate(() => document.querySelector('.booth-poster img')?.currentSrc ?? '');
      await p.addStyleTag({ content: HIDE_HOME });
      await settleAfterReady(p, 4000, 'settled check-poster.mjs capture');
      const r = await p.locator('.booth-frame').boundingBox();
      const png = await p.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, h - r.y) }, timeout: timeoutMs() });
      if (process.env.DEBUG_POSTERS) {
        const out = new URL('./lamp-review/09b/poster-check/', import.meta.url).pathname;
        mkdirSync(out, { recursive: true });
        writeFileSync(`${out}${entry.name}-${w}x${h}${dark ? '-dark' : ''}-live.png`, png);
      }
      await p.close();
      const file = shown ? PUB + new URL(shown).pathname.slice(1) : PUB + 'booth/' + (dpr > 1 || entry.name === 'cabinet' ? entry.dark[1] : entry.dark[0]);
      const diff = await compare(png, file);
      const ok = diff <= THRESHOLD && picked === entry.name;
      if (!ok) fails++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${w}x${h}${dark ? ' first visit' : ''}: picked ${picked} (want ${entry.name}), poster ${file.replace(PUB, '/')} vs live: mean difference ${diff.toFixed(2)}% (limit ${THRESHOLD}%)`);
    }
// P2 (09): each project header's tray poster against the live tray shot (desktop and phone)
for (const slug of groups && !groups.some((name) => name.startsWith('tray-')) ? [] : process.env.TRAY ? process.env.TRAY.split(',').filter(Boolean) : process.env.ONLY_HOME ? [] : SLUGS) {
  for (const t of TRAY.filter((t) => !groups || groups.includes('tray-' + (t.suffix ? t.suffix.slice(1) : 'wide')))) {
    const [w, h, dpr, mobile] = t.render;
    const file = `booth/tray/${slug}${t.suffix}.webp`;
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    p.setDefaultTimeout(timeoutMs());
    await p.addInitScript(() => {
      sessionStorage.setItem('vm:opened:v1', '1');
      window.__boothAnimHold = 1;
    });
    await p.goto(`${BASE}/work/${slug}?gpu=high`, { waitUntil: 'domcontentloaded' });
    // the poster the page picked, read before the booth is ready (the poster leaves the page 450ms after)
    const shown = await p.evaluate(() => document.querySelector('#booth-tray-poster')?.getAttribute('src') ?? '');
    await p.waitForSelector('.booth-stage[data-ready="true"]');
    await waitForBoothSettled(p, 'poster booth readiness');
    // the neighbours load when idle and fade in: capture the settled shelf, not a moment in its loading
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(2500);
    await p.addStyleTag({ content: HIDE_TRAY });
    await settleAfterReady(p, 5000, 'settled check-poster.mjs capture');
    const r = await p.locator('.booth-stage').boundingBox();
    const png = await p.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, h - r.y) }, timeout: timeoutMs() });
    await p.close();
    const diff = await compare(png, PUB + file);
    const ok = diff <= THRESHOLD && shown === `/${file}`;
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${w}x${h} tray ${slug}: picked ${shown}, poster /${file} vs live header: mean difference ${diff.toFixed(2)}% (limit ${THRESHOLD}%)`);
  }
}
await b.close();
process.exit(fails ? 1 : 0);
