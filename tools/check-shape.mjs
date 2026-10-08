/**
 * L1 + L7 (09B): the shape classifier, in a real browser, at every viewport Vish tests on.
 *   1. Every L7 viewport (width x svh height): the boot script's shape (<html data-shape>, before
 *      first paint) equals the runtime classifier's, and both equal the expected shape and columns.
 *   2. Toolbar test: at 393 wide, only the height changes (659 → 750 → 659 → 852): the shape never changes.
 *   3. Hysteresis: a window dragged across 0.88 and 1.3 changes the shape only past the ±0.04 band,
 *      and a rotation 1032x1230 ↔ 1376x980 switches both ways.
 *   node tools/check-shape.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';

export const MATRIX = [
  [390, 664, 'tall', 2], [393, 659, 'tall', 2], [393, 852, 'tall', 2], [430, 932, 'tall', 2],
  [750, 393, 'phone-landscape', 3], [932, 430, 'phone-landscape', 3],
  [768, 1024, 'tall', 3], [820, 1180, 'tall', 3], [1032, 1230, 'tall', 3], [1032, 1260, 'tall', 3],
  [1376, 940, 'wide', 3], [1376, 980, 'wide', 3], [1180, 820, 'wide', 3], [1024, 1366, 'tall', 3],
  [1440, 900, 'wide', 3], [1568, 980, 'wide', 3], [1920, 1080, 'wide', 3], [2560, 1440, 'wide', 3],
  // not on the L7 list: square is reached by a small laptop with a tall window
  [1180, 1000, 'square', 3], [1024, 1000, 'square', 3],
];

const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};
const shapeNow = (p) => p.evaluate(() => ({ boot: document.documentElement.dataset.shape, cols: document.documentElement.dataset.columns, live: window.__boothShape?.() }));

// 1. the matrix (house lights: no WebGL needed to classify)
for (const [w, h, want, cols] of MATRIX) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => localStorage.setItem('vm:houseLights:v2', '1'));
  const p = await ctx.newPage();
  await p.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
  const boot = await p.evaluate(() => document.documentElement.getAttribute('data-shape'));
  await p.waitForFunction(() => !!window.__boothShape);
  const s = await shapeNow(p);
  ok(boot === want && s.live.shape === want && s.live.columns === cols, `${w}x${h}: aspect ${(w / h).toFixed(3)} → ${s.live.shape}, ${s.live.columns} columns (boot ${boot}; want ${want}, ${cols})`);
  await ctx.close();
}

// 2 + 3: live resizes on one page
const ctx = await b.newContext({ viewport: { width: 393, height: 659 } });
await ctx.addInitScript(() => localStorage.setItem('vm:houseLights:v2', '1'));
const p = await ctx.newPage();
await p.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__boothShape);
const step = async (w, h) => {
  await p.setViewportSize({ width: w, height: h });
  await p.waitForTimeout(400); // past the 150ms debounce
  return (await shapeNow(p)).live.shape;
};
{
  const seen = [];
  for (const h of [659, 750, 659, 852, 700]) seen.push(await step(393, h));
  ok(seen.every((s) => s === 'tall'), `toolbar test at 393 wide, heights 659/750/659/852/700: ${seen.join(', ')} (never changes)`);
}
{
  // a window dragged wider at 1000 tall (each step > 2%, the recompute threshold): 0.88 is crossed at 880,
  // but square only from 920 (0.92); wide only from 1340 (1.34). Back down: wide until 1260, tall only under 840
  const up = [], down = [];
  for (const w of [850, 880, 905, 925, 1100, 1300, 1330, 1360]) up.push(`${w}:${await step(w, 1000)}`);
  for (const w of [1330, 1290, 1255, 1100, 900, 870, 845, 820]) down.push(`${w}:${await step(w, 1000)}`);
  const at = (list, w) => list.find((x) => x.startsWith(`${w}:`)).split(':')[1];
  ok(at(up, 880) === 'tall' && at(up, 905) === 'tall' && at(up, 925) === 'square' && at(up, 1330) === 'square' && at(up, 1360) === 'wide', `drag wider: ${up.join(' ')}`);
  ok(at(down, 1290) === 'wide' && at(down, 1255) === 'square' && at(down, 845) === 'square' && at(down, 820) === 'tall', `drag narrower: ${down.join(' ')}`);
}
{
  const seq = [];
  for (const [w, h] of [[1032, 1230], [1376, 980], [1032, 1230], [1376, 980], [1032, 1230]]) seq.push(`${w}x${h}:${await step(w, h)}`);
  ok(seq.join(' ') === '1032x1230:tall 1376x980:wide 1032x1230:tall 1376x980:wide 1032x1230:tall', `iPad Pro 13 rotation: ${seq.join(' ')}`);
}
{
  const seq = [];
  for (const [w, h] of [[2560, 1440], [1376, 940], [1032, 1230], [393, 659], [1032, 1230], [1376, 940], [2560, 1440]]) seq.push(`${w}x${h}:${await step(w, h)}`);
  ok(seq.join(' ') === '2560x1440:wide 1376x940:wide 1032x1230:tall 393x659:tall 1032x1230:tall 1376x940:wide 2560x1440:wide', `resize sequence: ${seq.join(' ')}`);
}
{
  await p.goto(BASE + '/about?shape=square', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__boothShape);
  const s = await shapeNow(p);
  ok(s.boot === 'square' && s.live.shape === 'square' && s.live.forced, `?shape=square at 2560x1440 → ${s.live.shape} (boot ${s.boot})`);
}
await b.close();
console.log(fails ? `✗ ${fails} failure(s)` : '✓ shape classifier');
process.exit(fails ? 1 : 0);
