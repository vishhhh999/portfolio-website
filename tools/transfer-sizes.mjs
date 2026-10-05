/**
 * H3 / H4 / K7: bytes over the wire, measured with the DevTools protocol (encoded bytes as sent):
 *   JS (gzip) before the 3D loads and the lazy 3D chunk(s), on "/" at 1440×900
 *   each lineup project page on a phone (390×844 @3x, touch), before any scroll: total and by kind
 *   model bytes (GLB + Basis transcoder) on first load of "/" and of /work/sonde, desktop and phone
 *   node tools/transfer-sizes.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { gzipSync } from 'zlib';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const SLUGS = ['too-yumm', 'jsw-sports', 'mitooshi', 'sonde', 'house-of-hex', 'bengal-t20', 'sook', 'shunya', 'indo-thai'];
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const MB = (n) => +(n / 1048576).toFixed(2);

async function load(url, phone, settle = 5000) {
  const ctx = await b.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width: 1568, height: 980 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const urls = new Map();
  const bytes = new Map();
  cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
  cdp.on('Network.loadingFinished', (e) => bytes.set(e.requestId, e.encodedDataLength));
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  if (await p.locator('.booth-stage').count()) await p.waitForSelector('.booth-stage[data-ready="true"]').catch(() => {});
  await p.waitForTimeout(settle);
  const list = [...bytes].map(([id, n]) => ({ url: urls.get(id) ?? '', n }));
  await ctx.close();
  const kind = (u) => (/\.glb$/.test(u) ? 'models' : /\/basis\//.test(u) ? 'basis' : /\.js(\?|$)/.test(u) ? 'js' : /\.(avif|webp|jpe?g|png|svg)(\?|$)/.test(u) ? 'images' : /\.(mp4|webm)(\?|$)/.test(u) ? 'video' : /\.woff2/.test(u) ? 'fonts' : 'other');
  const by = {};
  for (const r of list) by[kind(r.url)] = (by[kind(r.url)] ?? 0) + r.n;
  return { total: list.reduce((a, r) => a + r.n, 0), by, list };
}

// JS gz before / after 3D (same method as tools/metrics.mjs)
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const seen = new Map();
  let phase = 'pre3d';
  p.on('response', async (r) => {
    if (!/\.js(\?|$)/.test(r.url())) return;
    try { seen.set(r.url(), { phase, gz: gzipSync(await r.body()).length }); } catch {}
  });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  phase = 'lazy';
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
  const sum = (ph) => +([...seen.values()].filter((v) => v.phase === ph).reduce((a, v) => a + v.gz, 0) / 1024).toFixed(1);
  console.log(`JS gz: before 3D ${sum('pre3d')} KB (budget 200) · lazy 3D ${sum('lazy')} KB (budget 480)`);
  await p.close();
}

console.log('\nPhone project pages, before scrolling (budget 1.5 MB):');
for (const slug of SLUGS) {
  const r = await load(`/work/${slug}`, true);
  const parts = Object.entries(r.by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${MB(n)}`).join(' · ');
  console.log(`  /work/${slug.padEnd(13)} ${MB(r.total)} MB ${r.total <= 1.5 * 1048576 ? 'ok' : 'OVER'}   (${parts})`);
}

console.log('\nModel bytes on first load (GLB + Basis transcoder):');
for (const [url, phone] of [['/', false], ['/work/sonde', false], ['/', true], ['/work/sonde', true]]) {
  const r = await load(url, phone, 8000);
  const glbs = r.list.filter((x) => /\.glb$/.test(x.url));
  console.log(`  ${phone ? 'phone  ' : 'desktop'} ${url.padEnd(12)} models ${MB(r.by.models ?? 0)} MB (${glbs.length} GLBs) + basis ${MB(r.by.basis ?? 0)} MB · page total ${MB(r.total)} MB`);
}
await b.close();
