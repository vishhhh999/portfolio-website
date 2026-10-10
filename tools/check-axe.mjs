import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * P8 (09): axe-core (WCAG 2.0/2.1/2.2 A and AA rules) on every route at 1568x980 and 390x844. Fails
 * on any serious or critical violation; moderate and minor ones are listed.
 *   node tools/check-axe.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ROUTES = (process.env.ROUTES || '/,/about,/archive,/house-lights,/work/too-yumm,/work/jsw-sports,/work/mitooshi,/work/sonde,/work/house-of-hex,/work/bengal-t20,/work/sook,/work/shunya,/work/indo-thai,/nope-404').split(',');
const b = await launch({ args: [] });
let serious = 0;
for (const [name, vp, mobile] of [['1568', { width: 1568, height: 980 }, false], ['390', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vm:opened:v1', '1'); sessionStorage.setItem('vm:hint:v1', '1'); } catch {} });
  const p = await ctx.newPage();
  p.setDefaultTimeout(timeoutMs());
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.addScriptTag({ content: AXE });
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, where: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
    });
    const bad = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    serious += bad.length;
    console.log(`${bad.length ? '✗' : '✓'} ${name} ${route}: ${bad.length} serious/critical, ${res.length - bad.length} other`);
    for (const v of res) console.log(`    ${v.impact} ${v.id} (${v.n}): ${v.help} ${v.where.join(' | ')}`);
  }
  await ctx.close();
}
await b.close();
process.exit(serious ? 1 : 0);
