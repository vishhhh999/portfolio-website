import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * Behaviour checks against a running build (node tools/behaviour.mjs):
 * hover plate + click through the canvas, tray, next project, house lights,
 * house lights (rows must have visible area; first-time visitors start with house lights OFF;
 * only the visitor's own toggle is remembered), /house-lights at small viewports, canvas
 * never remounted, console clean. Screenshots to tools/lamp-review/behaviour-*.png.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/', import.meta.url).pathname;
const browser = await launch({ args: [] });
const errors = [];
const results = {};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 60000 });
await p.waitForTimeout(1500);

// hover sweep across the row until a spec plate shows, then click through the canvas
let hit = null;
for (let y = 520; y <= 820 && !hit; y += 30)
  for (let x = 100; x <= 1340 && !hit; x += 40) {
    await p.mouse.move(x, y);
    await p.waitForTimeout(60);
    if (await p.$('.specchip[data-visible="true"]')) hit = [x, y];
  }
results.hover = hit ? await p.$eval('.specchip[data-visible="true"]', (e) => e.textContent) : null;
await p.screenshot({ path: OUT + 'behaviour-hover.png' });
if (hit) {
  await p.mouse.click(...hit);
  await p.waitForURL('**/work/**', { timeout: 10000 }).catch(() => {});
}
results.clickedTo = new URL(p.url()).pathname;
await p.waitForTimeout(3500);
await p.screenshot({ path: OUT + 'behaviour-tray.png' });
await p.evaluate(() => document.querySelector('a.workend__card--next')?.click());
await p.waitForTimeout(3500);
results.next = new URL(p.url()).pathname;
await p.click('a.wordmark');
await p.waitForTimeout(2500);
results.home = new URL(p.url()).pathname;
results.mounts = await p.evaluate(() => window.__boothMounts);
results.canvases = await p.$$eval('canvas', (c) => c.length);
await p.keyboard.press('i');
await p.waitForTimeout(1200);
results.indexRowsVisible = await p.$$eval('.index a', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).length);
await p.screenshot({ path: OUT + 'behaviour-index-1440.png' });
await p.keyboard.press('i');
await p.waitForTimeout(800);
await ctx.close();

// HOUSE LIGHTS: every project row must have visible area, whatever way you arrive. Fails the run otherwise.
const failures = [];
const rowArea = (q) =>
  q.$$eval('.index a', (els) =>
    els.map((e) => {
      let el = e, visible = true;
      for (; el; el = el.parentElement) { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) visible = false; }
      const r = e.getBoundingClientRect();
      return { title: e.querySelector('.index__title')?.textContent?.trim(), area: visible ? r.width * r.height : 0 };
    }),
  );
for (const [label, w, h] of [['1568', 1568, 980], ['1366', 1366, 768]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const q = await c.newPage();
  // a first-time visitor starts with house lights OFF: the booth, not a redirect
  await q.goto(BASE + '/', { waitUntil: 'networkidle' });
  await q.waitForTimeout(800);
  if (new URL(q.url()).pathname !== '/') failures.push(`${label}: first visit to / redirected to ${new URL(q.url()).pathname}`);
  if (!(await q.$('.booth-stage'))) failures.push(`${label}: first visit to / has no booth stage`);
  // visiting the page by link does not store a preference
  await q.goto(BASE + '/house-lights', { waitUntil: 'networkidle' });
  if ((await q.evaluate(() => localStorage.getItem('vm:houseLights:v2'))) === '1') failures.push(`${label}: visiting /house-lights stored a preference`);
  const rows = await rowArea(q);
  if (rows.length !== 9) failures.push(`${label}: expected 9 rows, found ${rows.length}`);
  for (const r of rows) if (!(r.area > 0)) failures.push(`${label}: row "${r.title}" has zero visible area`);
  if (!(await q.$eval('h1', (e) => e.textContent.includes('House lights')))) failures.push(`${label}: /house-lights rendered the wrong page`);
  // toggle from the booth with the rocker, then a fresh load honours that choice
  await q.goto(BASE + '/', { waitUntil: 'networkidle' });
  await q.evaluate(() => localStorage.removeItem('vm:houseLights:v2'));
  await q.click('.rocker');
  await q.waitForURL('**/house-lights', { timeout: 10000 }).catch(() => failures.push(`${label}: rocker did not open house lights`));
  for (const r of await rowArea(q)) if (!(r.area > 0)) failures.push(`${label}: after rocker, row "${r.title}" has zero visible area`);
  await q.screenshot({ path: OUT + `behaviour-houselights-${label}.png` });
  await q.goto(BASE + '/', { waitUntil: 'networkidle' });
  await q.waitForURL('**/house-lights', { timeout: 10000 }).catch(() => failures.push(`${label}: remembered choice not honoured on reload`));
  await q.click('.rocker');
  await q.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => failures.push(`${label}: rocker did not switch house lights off`));
  results[`houseLights ${label}`] = { rows: rows.length, minArea: Math.min(...rows.map((r) => r.area)) | 0 };
  await c.close();
}
results.failures = failures;

// /index at small laptop sizes, arriving from a scrolled project page
for (const [w, h] of [[1366, 768], [1280, 720]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const q = await c.newPage();
  await q.goto(BASE + '/work/too-yumm', { waitUntil: 'networkidle' });
  await q.mouse.wheel(0, 3000);
  await q.waitForTimeout(1200);
  await q.click('a[href="/house-lights"]');
  await q.waitForTimeout(1500);
  results[`index ${w}x${h}`] = {
    scrollY: await q.evaluate(() => window.scrollY),
    rowsVisible: await q.$$eval('.index a', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).length),
  };
  await q.mouse.move(w / 2, h / 2);
  await q.mouse.wheel(0, 2000);
  await q.waitForTimeout(1600);
  results[`index ${w}x${h}`].canScroll = (await q.evaluate(() => window.scrollY)) > 100;
  await q.screenshot({ path: OUT + `behaviour-index-${w}.png` });
  await c.close();
}
console.log(JSON.stringify(results, null, 2));
console.log('errors', errors.filter((e) => !e.includes('THREE.Clock')));
await browser.close();
if (failures.length) {
  console.error('FAIL\n  ' + failures.join('\n  '));
  process.exit(1);
}
