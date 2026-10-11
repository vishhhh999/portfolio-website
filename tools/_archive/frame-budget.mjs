import { launch, timeoutMs } from './lib/browser.mjs';
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
const b = await launch({ args: [] });
async function run(vp, q, mobile) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1')); // J5: no opening strike in steady-state checks
  p.setDefaultTimeout(timeoutMs());
  await p.goto(`${BASE}/?perf&gpu=high${q}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: timeoutMs() });
  await p.waitForTimeout(3000);
  // B5 (08): a still frame (nothing changed: side renders reused) and a moving one (all forced)
  const still = await p.evaluate((n) => window.__boothPasses(n, false), N);
  const moving = await p.evaluate((n) => window.__boothPasses(n, true), N);
  await ctx.close();
  return { ...still, still, moving, frameP50: still.frameP50, movingP50: moving.frameP50 };
}
const rows = [];
const desk = { width: 2560, height: 1440 };
const base = await run(desk, '', false);
const pct = (a, b) => `${(((a - b) / a) * 100).toFixed(0)}%`;
rows.push(['desktop 2560x1440, all on', base.frameP50, base.movingP50, `still ${JSON.stringify(base.still)} · moving ${JSON.stringify(base.moving)}`]);
for (const f of (process.env.FEATURES || 'ssao,vsm,screencombine,reflector,msaa4').split(',')) {
  const r = await run(desk, `&no=${f}`, false);
  rows.push([`desktop, no=${f}`, r.frameP50, r.movingP50, `vs all on: still ${pct(base.frameP50, r.frameP50)}, moving ${pct(base.movingP50, r.movingP50)}`]);
}
const mob = await run({ width: 390, height: 844 }, '&tier=mobile', true);
rows.push(['mobile tier 390x844 @2x, all on', mob.frameP50, mob.movingP50, `still ${JSON.stringify(mob.still)}`]);
console.log('| config | still frame p50 (ms, SwiftShader) | moving frame p50 | detail |\n|---|---|---|---|');
for (const [a, c, m, d] of rows) console.log(`| ${a} | ${c} | ${m} | ${d} |`);
await b.close();
