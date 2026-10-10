/** Hardware-only frame and shelf scroll smoke check for Vishesh's PC. */
import { writeFileSync } from 'node:fs';
import { launch, timeoutMs } from './lib/browser.mjs';

if (process.env.GL !== 'gpu') {
  console.error('REFUSED: gpu-smoke needs GL=gpu and a verified hardware WebGL renderer. Software results are not a verdict.');
  process.exit(2);
}
const base = process.env.BASE || 'http://localhost:3100';
const browser = await launch();
const sizes = [
  { width: 2560, height: 1440 },
  { width: 1568, height: 980 },
  { width: 1032, height: 1230 },
  { width: 393, height: 852 },
];
const rows = [];
try {
  for (const size of sizes) {
    const phone = size.width < 600;
    const context = await browser.newContext({ viewport: size, isMobile: phone, hasTouch: phone });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs());
    await page.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
    await page.goto(base + '/?perf', { waitUntil: 'networkidle', timeout: timeoutMs() });
    await page.waitForSelector('.booth-stage[data-ready="true"]', { timeout: timeoutMs() });
    await page.waitForFunction(() => typeof window.__boothPasses === 'function' && typeof window.__boothPerf === 'function', null, { timeout: timeoutMs() });
    const still = await page.evaluate(() => window.__boothPasses(30));
    const moving = await page.evaluate(() => window.__boothPasses(30, true));
    let scrollFps = null;
    if (size.height > size.width) {
      scrollFps = [];
      await page.waitForTimeout(4200);
      const end = await page.evaluate(() => Math.max(0, document.querySelector('.booth-frame').getBoundingClientRect().bottom + scrollY - innerHeight));
      for (let y = 0; y <= end; y += Math.max(1, Math.floor(size.height / 4))) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(200);
        const sample = await page.evaluate(() => window.__boothPerf());
        if (sample.frames >= 2 && sample.fps > 0) scrollFps.push(sample.fps);
      }
    }
    const scrollMin = scrollFps?.length ? Math.min(...scrollFps) : null;
    const pass = size.width === 2560 ? still.frameP50 <= 8 && still.frameP95 <= 11 && moving.frameP50 <= 8 && moving.frameP95 <= 11
      : size.width === 1032 ? scrollMin !== null && scrollMin >= 50 : null;
    rows.push({ size: `${size.width}x${size.height}`, still, moving, scrollMin, verdict: pass === null ? 'MEASURED' : pass ? 'PASS' : 'FAIL' });
    await context.close();
  }
} finally { await browser.close(); }
const lines = [
  '# GPU smoke',
  '',
  `Renderer: ${browser.__boothRenderer}. Phone emulation on a desktop GPU is not an iPhone result.`,
  '',
  '| Renderer | Viewport | Still p50 / p95 ms | Moving p50 / p95 ms | Shelf min fps | Result |',
  '| --- | --- | ---: | ---: | ---: | --- |',
  ...rows.map((row) => `| ${browser.__boothRenderer} | ${row.size} | ${row.still.frameP50} / ${row.still.frameP95} | ${row.moving.frameP50} / ${row.moving.frameP95} | ${row.scrollMin ?? 'n/a'} | ${row.verdict} |`),
  '',
  'Budgets: 2560x1440 p50 at most 8 ms and p95 at most 11 ms for still and moving; tall shelf scroll at least 50 fps.',
];
console.log(lines.join('\n'));
writeFileSync(new URL('../gpu-smoke.md', import.meta.url), lines.join('\n') + '\n');
process.exit(rows.some((row) => row.verdict === 'FAIL') ? 1 : 0);
