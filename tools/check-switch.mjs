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
// a sample in the header, clicked on the canvas where it is drawn (the back row stays visible, dimmed)
const at = await p.evaluate(() => {
  const b = window.__boothBoxes?.().boxes.sonde;
  return b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 } : null;
});
if (at && at.y > 0 && at.y < 980) await measure('booth sample in the header (→ /work/sonde)', () => p.mouse.click(at.x, at.y), '/work/sonde');
else console.log(`${label} booth sample in the header: not measurable on this build (no __boothBoxes or off screen)`);
await b.close();
