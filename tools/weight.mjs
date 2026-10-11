import { launch } from './lib/browser.mjs';
/**
 * First-visit weight and timing: bytes transferred, request count, LCP and time to booth ready.
 *   node tools/weight.mjs [/path ...]   default / and /work/too-yumm, desktop 1568x980 and phone 393x852
 * Times under software WebGL are not real-device numbers; the bytes are.
 */
const BASE = process.env.BASE || 'http://localhost:3100';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/work/too-yumm'];
const browser = await launch();
const MB = (n) => (n / 1048576).toFixed(2);

for (const phone of [false, true]) {
  for (const path of paths) {
    const ctx = await browser.newContext(phone
      ? { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1568, height: 980 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const bytes = new Map();
    const urls = new Map();
    cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
    cdp.on('Network.loadingFinished', (e) => bytes.set(e.requestId, e.encodedDataLength));
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(BASE + path, { waitUntil: 'load' });
    let ready = null;
    if (await page.locator('.booth-frame, .work-stage').count() && !path.includes('gpu=low')) {
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-booth-ready'), null, { timeout: 300_000 }).then(() => { ready = Date.now() - t0; }).catch(() => {});
    }
    await page.waitForTimeout(3000);
    const lcp = await page.evaluate(() => Math.round(window.__lcp));
    const list = [...bytes].map(([id, n]) => ({ url: urls.get(id) ?? '', n }));
    const total = list.reduce((a, r) => a + r.n, 0);
    const kinds = {};
    for (const r of list) {
      const k = /\.glb/.test(r.url) ? 'glb' : /\.js/.test(r.url) ? 'js' : /\.(avif|webp|png|jpe?g)/.test(r.url) ? 'img' : /\.(ktx2|wasm|bin)/.test(r.url) ? 'gpu-data' : 'other';
      kinds[k] = (kinds[k] ?? 0) + r.n;
    }
    console.log(`${phone ? 'phone  ' : 'desktop'} ${path}: ${MB(total)}MB, ${list.length} requests, LCP ${lcp}ms, booth ready ${ready ?? 'n/a'}ms | ${Object.entries(kinds).map(([k, v]) => `${k} ${MB(v)}`).join(', ')}`);
    await ctx.close();
  }
}
await browser.close();
