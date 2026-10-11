import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * B5: house lights is a mode of the current page, never a navigation. On / and /work/jsw-sports:
 * I (and the rocker) toggles booth ↔ flat in place: the URL and the page content stay the same,
 * the booth stage is gone while on and back when off. A stored choice loads the flat version
 * directly. The lamp panel does not exist on /about and /archive.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await launch({ args: [] });
const ctx = await b.newContext({ viewport: { width: 1568, height: 980 } });
const p = await ctx.newPage();
p.setDefaultTimeout(timeoutMs());
let fails = 0;
const ok = (c, m) => {
  if (!c) fails++;
  console.log(`${c ? 'PASS' : 'FAIL'} ${m}`);
};
const state = () =>
  p.evaluate(() => ({
    url: location.pathname + location.search,
    on: document.documentElement.hasAttribute('data-house-lights'),
    stage: !!document.querySelector('.booth-stage'),
    canvasShown: (() => {
      const c = document.querySelector('.booth-canvas');
      return !!c && getComputedStyle(c).display !== 'none';
    })(),
    flatIndex: (() => {
      const f = document.querySelector('.houselights--inline');
      return !!f && getComputedStyle(f).display !== 'none';
    })(),
    title: document.querySelector('main h1')?.textContent ?? '',
    text: (document.querySelector('main')?.innerText ?? '').length,
    rocker: document.querySelector('.rocker')?.getAttribute('aria-pressed'),
  }));
const press = async (k) => {
  await p.keyboard.press(k);
  await p.waitForTimeout(600);
};

for (const route of ['/work/jsw-sports', '/']) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  // C4: on project pages the panel is a floating pill until it is opened
  if (await p.locator('.panel__pill').count()) await p.click('.panel__pill');
  await p.waitForTimeout(200);
  const a = await state();
  ok(!a.on && a.stage && a.rocker === 'false', `${route}: loads with the booth (stage ${a.stage}, house lights ${a.on})`);
  await press('i');
  const b1 = await state();
  ok(b1.url === route, `${route}: I keeps the URL (${b1.url})`);
  ok(b1.on && !b1.stage && !b1.canvasShown && b1.rocker === 'true', `${route}: house lights on in place (stage ${b1.stage}, canvas shown ${b1.canvasShown})`);
  ok(b1.title === a.title, `${route}: same page content (h1 "${b1.title}")`);
  if (route === '/') ok(b1.flatIndex, '/: the flat index shows in place of the booth');
  // the rocker switches it back
  await p.click('.rocker');
  await p.waitForTimeout(600);
  const c = await state();
  ok(c.url === route && !c.on && c.stage && c.rocker === 'false', `${route}: rocker turns the booth back on, same URL (${c.url})`);
  if (route === '/') ok(!c.flatIndex, '/: flat index hidden again');
}

// a stored choice: every page loads flat, with no redirect
await press('i');
for (const route of ['/', '/work/sook']) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  const s = await state();
  ok(s.url === route && s.on && !s.stage, `stored choice: ${route} loads flat at the same URL (${s.url})`);
}
await press('i');

for (const route of ['/about', '/archive']) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  const n = await p.locator('.panel').count();
  ok(n === 0, `${route}: no lamp panel`);
}
// nothing in the UI links to /house-lights
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
const links = await p.evaluate(() => [...document.querySelectorAll('a[href="/house-lights"]')].length);
ok(links === 0, `no link to /house-lights on / (${links})`);
await p.goto(BASE + '/house-lights', { waitUntil: 'networkidle' });
ok((await p.locator('.index a').count()) > 5, '/house-lights still renders the flat index as a direct link');
await b.close();
console.log(fails ? `✗ ${fails} failure(s)` : '✓ house lights is a mode, never a page');
process.exit(fails ? 1 : 0);
