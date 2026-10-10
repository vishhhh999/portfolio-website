import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * Horizontal overflow check: every route at a 390px phone viewport must have
 * document.documentElement.scrollWidth <= clientWidth. Exits 1 on any failure.
 *   npm run build && npx next start -p 3100 &   then   node tools/check-overflow.mjs
 * Needs Playwright (global install is fine): PLAYWRIGHT=/path/to/playwright node tools/check-overflow.mjs
 */
import { createRequire } from 'module';
import { readdirSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const WIDTH = Number(process.env.WIDTH || 390);

const slugs = readdirSync(new URL('../content/work/', import.meta.url))
  .filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !['index.ts', 'imported.ts', 'corrections.ts'].includes(f))
  .map((f) => f.replace(/\.ts$/, ''));
const routes = ['/', ...slugs.map((s) => `/work/${s}`), '/archive', '/about', '/house-lights'];

const browser = await launch({ args: [] });
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const results = [];
for (const route of routes) {
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  // let the booth boot and the drei overlays mount, then scroll the whole page once
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1)
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, wide };
  });
  results.push({ route, ...m, ok: m.scrollWidth <= m.clientWidth });
  await page.close();
}
await browser.close();
console.table(results.map(({ wide, ...r }) => ({ ...r, offenders: r.ok ? '' : wide.join(' ') })));
const bad = results.filter((r) => !r.ok);
if (bad.length) {
  console.error(`✗ ${bad.length} route(s) overflow at ${WIDTH}px`);
  process.exit(1);
}
console.log(`✓ no horizontal overflow at ${WIDTH}px on ${results.length} routes`);
