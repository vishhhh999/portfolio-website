/**
 * Phase metrics against a running build: JS gz before/after the 3D loads,
 * first readable paint (FCP/LCP, unthrottled and on a 4x CPU + fast-4G profile),
 * plane-vs-DOM drift during fast scroll, video plane check.   node tools/metrics.mjs
 */
import { createRequire } from 'module';
import { gzipSync } from 'zlib';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const out = {};

// JS sizes
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const seen = new Map();
  let phase = 'pre3d';
  p.on('response', async (r) => {
    if (!r.url().endsWith('.js')) return;
    try { seen.set(r.url(), { phase, gz: gzipSync(await r.body()).length }); } catch {}
  });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  phase = 'lazy';
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 60000 });
  const sum = (ph) => +([...seen.values()].filter((v) => v.phase === ph).reduce((a, v) => a + v.gz, 0) / 1024).toFixed(1);
  out.jsKB = { pre3d: sum('pre3d'), lazy3d: sum('lazy') };
  await p.close();
}

// first readable paint
for (const [label, throttle] of [['unthrottled', false], ['4x CPU + fast 4G', true]]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  if (throttle) {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  }
  await p.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const t0 = Date.now();
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 120000 });
  const live = Date.now() - t0;
  const m = await p.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, lcp: window.__lcp }));
  out[`paint (${label})`] = { firstReadablePaintMs: Math.round(m.fcp), lcpMs: Math.round(m.lcp), liveBoothMs: live, note: 'headline + poster are the first paint; live booth crossfades in later' };
  await ctx.close();
}

// drift during fast scroll
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/work/too-yumm?gpu=high&drift', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 60000 });
  await p.keyboard.press('2'); // relit planes only exist off D50 (B1)
  await p.waitForFunction(() => document.querySelectorAll('[data-lit="true"]').length >= 2, null, { timeout: 60000 }).catch(() => {});
  await p.mouse.move(700, 450);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, i % 6 < 3 ? 900 : -700); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  out.drift = await p.evaluate(() => window.__boothDrift?.());
  await p.close();
}

// video plane
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/work/mitooshi?gpu=high', { waitUntil: 'networkidle' });
  await p.keyboard.press('2');
  await p.evaluate(() => document.querySelector('.proof__image video')?.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(6000);
  out.videoPlane = await p.evaluate(() => { const v = document.querySelector('.proof__image video'); return v && { lit: v.dataset.lit, playing: !v.paused, muted: v.muted }; });
  await p.click('.proof__play').catch(() => {});
  await p.waitForTimeout(800);
  out.videoPlayer = await p.evaluate(() => { const v = document.querySelector('dialog.player video'); return v && { open: document.querySelector('dialog.player').open, muted: v.muted, controls: v.controls }; });
  await p.screenshot({ path: new URL('./lamp-review/video-player.png', import.meta.url).pathname });
  await p.close();
}
console.log(JSON.stringify(out, null, 2));
await b.close();
