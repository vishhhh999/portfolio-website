import { launch, timeoutMs, waitForBoothSettled, settleAfterReady } from './lib/browser.mjs';
/**
 * L7 (09B): the home booth at every viewport Vish tests on (width x svh height, tools/check-shape.mjs
 * MATRIX), in one load each:
 *   - the arrangement for the classified shape (wide → the cabinet, square → the 4-column shelf,
 *     tall → the 2 or 3 column shelf)
 *   - every sample at or over its size floor (the cabinet's own floors; 12% of the frame on the square
 *     shelf, 14% on the tall shelf), wholly inside the frame (on the tall shelf: inside the frame the
 *     page scrolls down, so reachable), boxes overlapping ≤ 3%
 *   - no horizontal scroll
 *   - the lamp panel never over a shelf label or a sample tag (tall: scrolled top to bottom in steps,
 *     wherever the floating panel is shown)
 *   - picking: a grid of clicks over the first screen opens only what is seen there
 *   node tools/check-shapes.mjs   (against a running build)   ONLY=393x659,1032x1230 to limit
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const MATRIX = [
  [390, 664, 'tall'], [393, 659, 'tall'], [393, 852, 'tall'], [430, 932, 'tall'], [750, 393, 'phone-landscape'], [932, 430, 'phone-landscape'],
  [768, 1024, 'tall'], [820, 1180, 'tall'], [1032, 1230, 'tall'], [1032, 1260, 'tall'], [1376, 940, 'wide'], [1376, 980, 'wide'], [1180, 820, 'wide'],
  [1024, 1366, 'tall'], [1440, 900, 'wide'], [1568, 980, 'wide'], [1920, 1080, 'wide'], [2560, 1440, 'wide'], [1180, 1000, 'square'], [1024, 1000, 'square'],
].filter(([w, h]) => process.env.ONLY ? process.env.ONLY.split(',').includes(`${w}x${h}`) : process.env.SIZES === 'all' ? true : ['393x659', '1032x1230', '1440x900', '1180x1000'].includes(`${w}x${h}`));
const LAYOUT = (shape, w) => (shape === 'tall' ? (w < 600 ? 'shelf2' : 'shelf3') : shape === 'square' ? 'shelf4' : 'wide');
const hit = (a, c) => a.left < c.right - 0.5 && a.right > c.left + 0.5 && a.top < c.bottom - 0.5 && a.bottom > c.top + 0.5;
const b = await launch({ args: [] });
let fails = 0;
const rows = [];
for (const [w, h, want] of MATRIX) {
  const phone = w < 600;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone || (want === 'tall' && w < 1100), hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  const p = await ctx.newPage();
  p.setDefaultTimeout(timeoutMs());
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]');
  await waitForBoothSettled(p, 'poster booth readiness');
  await p.waitForTimeout(1500);
  const bad = [];
  let laptopVisibility = null;
  const s = await p.evaluate(() => ({ shape: document.documentElement.dataset.shape, layout: document.documentElement.dataset.layout, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (s.shape !== want) bad.push(`shape ${s.shape} (want ${want})`);
  if (s.layout !== LAYOUT(want, w)) bad.push(`layout ${s.layout} (want ${LAYOUT(want, w)})`);
  if (s.sw > s.iw) bad.push(`horizontal scroll ${s.sw} > ${s.iw}`);
  const sizes = await p.evaluate(() => window.__boothSizes());
  const floors = await p.evaluate(() => window.__boothSizeFloors());
  const under = Object.entries(sizes).filter(([k, v]) => v < floors[k]);
  if (under.length) bad.push(`under the floor: ${under.map(([k, v]) => `${k} ${v}% < ${floors[k]}%`).join(', ')}`);
  const smallest = Object.entries(sizes).sort((a, c) => a[1] - c[1])[0];
  const { boxes } = await p.evaluate(() => window.__boothBoxes());
  const f = await p.evaluate(() => JSON.parse(JSON.stringify(document.querySelector('.booth-frame').getBoundingClientRect())));
  if (want === 'wide' && w / h >= 1.5) {
    const panel = await p.locator('#panel-slot').boundingBox();
    if (f.bottom > h + 1 || !panel || panel.y + panel.height > h + 1) bad.push('desktop cabinet and lamp panel do not fit the first screen');
  }
  if (w === 1032 && h === 1230) {
    laptopVisibility = await p.evaluate(() => window.__boothVisibility('mitooshi'));
    if (laptopVisibility.total < 100 || laptopVisibility.fraction < 0.8) bad.push(`Mitooshi silhouette visible ${(100 * laptopVisibility.fraction).toFixed(1)}% (minimum 80%)`);
  }
  if (s.layout === 'shelf2') {
    // Force the short-lived first-visit hint on without changing its layout or waiting out its timer.
    const hint = await p.evaluate(() => {
      const el = document.querySelector('.boothhint');
      el.setAttribute('data-on', 'true');
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    if (hint.bottom > f.top || hint.top < 0 || hint.left < 0 || hint.right > w) bad.push('first-visit hint overlaps the shelf or leaves the phone viewport');
  }
  // the cabinet's samples: inside the frame; the shelf's: inside its frame (the page scrolls down it)
  const outside = Object.entries(boxes).filter(([, r]) => r.x0 < f.left - 1 || r.x1 > f.right + 1 || r.y0 < f.top - 1 || r.y1 > f.bottom + 1).map(([k]) => k);
  if (outside.length) bad.push(`outside the frame: ${outside.join(', ')}`);
  {
    const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
    const ks = Object.keys(boxes);
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++) {
        const A = boxes[ks[i]], B = boxes[ks[j]];
        const ov = area({ x0: Math.max(A.x0, B.x0), y0: Math.max(A.y0, B.y0), x1: Math.min(A.x1, B.x1), y1: Math.min(A.y1, B.y1) }) / Math.min(area(A), area(B));
        if (ov > 0.03 && s.layout !== 'wide') bad.push(`${ks[i]} / ${ks[j]} overlap ${(ov * 100).toFixed(1)}%`);
      }
  }
  // the panel over labels and tags, scrolled top to bottom on the shelf (each step left to settle)
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = s.layout.startsWith('shelf') ? Math.ceil(total / (h * 0.45)) + 1 : 1;
  const overlaps = new Set();
  for (let i = 0; i <= steps; i++) {
    const y = steps > 1 ? Math.min(total, Math.round((i * total) / steps)) : 0;
    const moved = await p.evaluate((y) => {
      window.__shScrolls = 0;
      if (!window.__shCount) (window.__shCount = true), addEventListener('scroll', () => window.__shScrolls++, { passive: true });
      const from = scrollY;
      scrollTo({ top: y, behavior: 'instant' });
      return Math.abs(scrollY - from) > 0.5;
    }, y);
    if (moved) await p.waitForFunction(() => window.__shScrolls > 0, null, { timeout: timeoutMs() });
    await p.waitForTimeout(1700);
    const r = await p.evaluate(() => {
      const panel = document.querySelector('.panel');
      if (!panel) return null;
      const shown = panel.getAttribute('data-away') !== 'true' && +getComputedStyle(panel).opacity > 0.05;
      const pr = JSON.parse(JSON.stringify(panel.getBoundingClientRect()));
      const labels = Object.entries(window.__boothShelfLabels?.() ?? {}).filter(([, l]) => l.bottom > 0 && l.top < innerHeight);
      const tags = [...document.querySelectorAll('.sampletag[data-on="true"]')].map((t) => ['tag ' + t.textContent, JSON.parse(JSON.stringify(t.getBoundingClientRect()))]);
      return { shown, pr, prot: [...labels, ...tags] };
    });
    if (r?.shown) for (const [k, l] of r.prot) if (hit(r.pr, l)) overlaps.add(`${k}@${y}`);
  }
  if (overlaps.size) bad.push(`panel over ${[...overlaps].slice(0, 4).join(', ')}`);
  // picking over the first screen
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(1500);
  const pick = await p.evaluate(() => {
    const r = document.querySelector('.booth-stage').getBoundingClientRect();
    const out = { n: 0, picks: 0, wrong: [] };
    for (let i = 0; i < 30; i++)
      for (let j = 0; j < 20; j++) {
        const x = r.left + ((i + 0.5) / 30) * r.width, y = Math.max(r.top, 0) + ((j + 0.5) / 20) * (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        const { pick, seen } = window.__boothPickAt(x, y);
        out.n++;
        if (pick) out.picks++;
        if (pick && pick !== seen) out.wrong.push(`${pick}@${Math.round(x)},${Math.round(y)}`);
      }
    return out;
  });
  if (pick.wrong.length) bad.push(`picking: ${pick.wrong.length} points open what is not seen (${pick.wrong.slice(0, 3).join('; ')})`);
  const cols = s.layout === 'shelf2' ? 2 : s.layout === 'shelf3' ? 3 : s.layout === 'shelf4' ? 4 : '-';
  const shelves = s.layout === 'shelf2' ? 5 : s.layout === 'shelf3' ? 4 : s.layout === 'shelf4' ? 3 : '-';
  rows.push(`| ${w}x${h} | ${s.shape} | ${s.layout} | ${cols} | ${shelves} | ${smallest[0]} ${smallest[1]}% |`);
  fails += bad.length;
  console.log(`${bad.length ? '✗' : '✓'} ${w}x${h} ${s.shape} → ${s.layout}: smallest ${smallest[0]} ${smallest[1]}% (floor ${floors[smallest[0]]}%), ${steps + 1} scroll steps, ${pick.n} picks ok${laptopVisibility ? `, Mitooshi ${(100 * laptopVisibility.fraction).toFixed(1)}% visible` : ''}${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
  await ctx.close();
}
await b.close();
console.log('\n| Viewport | Shape | Arrangement | Columns | Shelves | Smallest sample (of the frame) |\n|---|---|---|---|---|---|\n' + rows.join('\n'));
console.log(fails ? `✗ ${fails} failure(s)` : '✓ every shape');
process.exit(fails ? 1 : 0);
