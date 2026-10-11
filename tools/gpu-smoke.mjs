/**
 * Real frame times on a hardware GPU (Vishesh's PC): GL=gpu node tools/gpu-smoke.mjs
 * For home and a project page at 2560x1440, 1568x980 and phone size: p50 / p95 of back-to-back
 * frames (still, and moving the camera every frame), plus the browser's own frame rate while the
 * pointer sweeps over the booth for two seconds. Refuses software WebGL. Writes gpu-smoke.md.
 */
import { writeFileSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

if (process.env.GL !== 'gpu') {
  console.error('REFUSED: gpu-smoke needs GL=gpu and a hardware WebGL renderer. Software numbers are not a verdict.');
  process.exit(2);
}
const base = process.env.BASE || 'http://localhost:3100';
const browser = await launch();
const rows = [];
try {
  for (const size of [{ width: 2560, height: 1440 }, { width: 1568, height: 980 }, { width: 393, height: 852 }]) {
    for (const path of ['/', '/work/sonde']) {
      const phone = size.width < 600;
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: phone ? 3 : 1, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      await page.goto(`${base}${path}?perf`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-booth-ready') && typeof window.__boothBench === 'function', null, { timeout: 60_000 });
      await page.waitForTimeout(1000);
      const still = await page.evaluate(() => window.__boothBench(60, false));
      const moving = await page.evaluate(() => window.__boothBench(60, true));
      const fps = await page.evaluate(() => new Promise((resolve) => {
        const t = [];
        const t0 = performance.now();
        const step = (now) => {
          t.push(now);
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth * (0.3 + 0.4 * Math.sin((now - t0) / 300) ** 2), clientY: innerHeight * 0.45 }));
          if (now - t0 < 2000) requestAnimationFrame(step);
          else resolve(Math.round((t.length - 1) / ((t[t.length - 1] - t[0]) / 1000)));
        };
        requestAnimationFrame(step);
      }));
      rows.push({ size: `${size.width}x${size.height}`, path, still, moving, fps });
      console.log(rows.at(-1));
      await context.close();
    }
  }
} finally { await browser.close(); }
const lines = [
  '# GPU smoke', '', `Renderer: ${browser.__boothRenderer}. Phone emulation on a desktop GPU is not an iPhone result.`, '',
  '| Viewport | Page | Still p50 / p95 ms | Moving p50 / p95 ms | Live fps | DPR |', '| --- | --- | ---: | ---: | ---: | ---: |',
  ...rows.map((r) => `| ${r.size} | ${r.path} | ${r.still.p50} / ${r.still.p95} | ${r.moving.p50} / ${r.moving.p95} | ${r.fps} | ${r.still.dpr} |`),
  '', 'Target: p95 under 8.3 ms at 2560x1440 (120 fps capable), still and moving.',
];
console.log(lines.join('\n'));
writeFileSync(new URL('../gpu-smoke.md', import.meta.url), lines.join('\n') + '\n');
