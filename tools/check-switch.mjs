/**
 * A3: project-to-project switching. With /work/too-yumm open, follow "Next on the tray" and then
 * click another sample in the booth header. Measures click → first animated booth frame (the
 * camera/tray starts moving), click → URL change, and every long task (> 50ms) in the 2s after.
 *
 *   node tools/check-switch.mjs [label]
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const label = process.argv[2] || 'run';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1568, height: 980 } });
p.setDefaultTimeout(600000);
await p.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ t: e.startTime, d: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
});
await p.goto(BASE + '/work/too-yumm', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
await p.waitForTimeout(2500);

async function measure(name, act, target) {
  await p.evaluate(() => {
    window.__long = [];
    // watch the booth's draw calls: the first frame after the click is the first animated frame
    const c = document.querySelector('.booth-canvas canvas');
    const gl = c.getContext('webgl2');
    if (!window.__drawHooked) {
      window.__drawHooked = true;
      for (const fn of ['drawArrays', 'drawElements']) {
        const o = gl[fn].bind(gl);
        gl[fn] = (...a) => {
          if (window.__armed && !window.__firstDraw) window.__firstDraw = performance.now();
          return o(...a);
        };
      }
    }
    window.__firstDraw = 0;
    window.__armed = false;
  });
  const t0 = await p.evaluate(() => {
    window.__armed = true;
    window.__t0 = performance.now();
    return window.__t0;
  });
  await act();
  await p.waitForURL('**' + target);
  const tUrl = await p.evaluate(() => performance.now() - window.__t0);
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => ({ first: window.__firstDraw ? window.__firstDraw - window.__t0 : -1, long: window.__long.filter((e) => e.t >= window.__t0 - 5).map((e) => e.d) }));
  console.log(`${label} ${name}: click → first booth frame ${r.first.toFixed(0)}ms · click → URL ${tUrl.toFixed(0)}ms · long tasks ${r.long.length ? r.long.join(', ') + 'ms' : 'none'}`);
  void t0;
}

await measure('next on the tray (→ /work/jsw-sports)', () => p.evaluate(() => document.querySelector('a.next')?.click()), '/work/jsw-sports');
await p.waitForTimeout(1500);
// a sample in the header, clicked on the canvas where it is drawn (the raised back samples stay
// visible, dimmed, behind the tray): the first one whose centre is inside the stage, clear of the masthead
const pick = await p.evaluate(() => {
  const st = window.__boothStageRect?.();
  const boxes = window.__boothBoxes?.().boxes ?? {};
  for (const slug of ['mitooshi', 'sonde', 'jsw-sports', 'house-of-hex']) {
    const b = boxes[slug];
    if (!b || !st) continue;
    const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2;
    if (x > st.left + 10 && x < st.right - 10 && y > 110 && y < st.bottom - 10) return { slug, x, y };
  }
  return null;
});
if (pick) await measure(`booth sample in the header (→ /work/${pick.slug})`, () => p.mouse.click(pick.x, pick.y), `/work/${pick.slug}`);
else console.log(`${label} booth sample in the header: none clickable in view on this build`);
await b.close();
