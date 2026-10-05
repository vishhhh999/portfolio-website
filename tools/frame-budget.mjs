/**
 * H2: the frame budget. At 2560x1440 (desktop tier) and 390x844 @2x (mobile tier), the home booth
 * under D50: per-pass timings (window.__boothPasses, each pass closed with a GPU sync) and the cost
 * of each feature, measured by switching it off (?perf&no=<feature>) and comparing frame p50.
 *
 *   node tools/frame-budget.mjs [n=6]   → a markdown table on stdout
 * Software rendering (SwiftShader) gives relative costs only; absolute GPU ms need a real GPU.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const N = +(process.argv[2] || 6);
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function run(vp, q, mobile) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.setDefaultTimeout(900000);
  await p.goto(`${BASE}/?perf&gpu=high${q}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 900000 });
  await p.waitForTimeout(3000);
  const r = await p.evaluate((n) => window.__boothPasses(n), N);
  await ctx.close();
  return r;
}
const rows = [];
const desk = { width: 2560, height: 1440 };
const base = await run(desk, '', false);
rows.push(['desktop 2560x1440, all on', base.frameP50, JSON.stringify(base)]);
for (const f of ['ssao', 'pcss', 'contact', 'screenlights', 'bloom', 'reflector', 'msaa']) {
  const r = await run(desk, `&no=${f}`, false);
  rows.push([`desktop, ${f} off`, r.frameP50, `saves ${(base.frameP50 - r.frameP50).toFixed(1)}ms (${(((base.frameP50 - r.frameP50) / base.frameP50) * 100).toFixed(0)}%)`]);
}
const mob = await run({ width: 390, height: 844 }, '&tier=mobile', true);
rows.push(['mobile tier 390x844 @2x, all on', mob.frameP50, JSON.stringify(mob)]);
console.log('| config | frame p50 (ms, SwiftShader) | detail |\n|---|---|---|');
for (const [a, c, d] of rows) console.log(`| ${a} | ${c} | ${d} |`);
await b.close();
