/**
 * B2 (08): MSAA 4x vs SMAA at 2560x1440. For each, two frames a few pixels of pointer parallax apart
 * (a slow camera drift); crops of the plinth edges, a bezel and the frame, enlarged 2x, side by side,
 * plus the per-pixel change between the two parallax frames inside the crops (edge crawl shows as
 * flicker along edges). Writes tools/lamp-review/08/aa-compare.png.
 *   node tools/aa-compare.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/08/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = {};
for (const [name, q] of [['MSAA 4x', '?gpu=high&perf&no=dof'], ['SMAA', '?gpu=high&perf&no=msaa,dof']]) {
  const p = await b.newPage({ viewport: { width: 2560, height: 1440 } });
  p.setDefaultTimeout(900000);
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await p.goto(BASE + '/' + q, { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]');
  await p.addStyleTag({ content: 'body > div[style*="position:fixed"]{display:none!important}' });
  shots[name] = [];
  for (const x of [1180, 1186]) {
    await p.mouse.move(x, 700);
    await p.waitForTimeout(6000);
    shots[name].push(await p.screenshot({ timeout: 900000 }));
  }
  await p.close();
}
await b.close();
// crops: plinth top edges + a bezel (centre-left), the frame's left post and sill corner
const crops = [{ left: 820, top: 820, width: 360, height: 220 }, { left: 430, top: 1080, width: 300, height: 220 }];
const tiles = [];
for (const name of Object.keys(shots)) {
  for (const c of crops) {
    const a = await sharp(shots[name][0]).extract(c).resize(c.width * 2, c.height * 2, { kernel: 'nearest' }).png().toBuffer();
    const raw = async (buf) => (await sharp(buf).extract(c).removeAlpha().raw().toBuffer());
    const [r0, r1] = [await raw(shots[name][0]), await raw(shots[name][1])];
    let crawl = 0;
    for (let i = 0; i < r0.length; i++) crawl += Math.abs(r0[i] - r1[i]);
    tiles.push({ name, c, a, crawl: crawl / r0.length });
  }
}
const W = crops.reduce((s, c) => s + c.width * 2 + 20, 0), H = (crops[0].height * 2 + 40) * 2;
const comps = [];
let y = 0;
for (const name of Object.keys(shots)) {
  let x = 0;
  const label = Buffer.from(`<svg width="${W}" height="36"><rect width="100%" height="100%" fill="#f2f0ea"/><text x="8" y="24" font-family="monospace" font-size="20">${name} · mean change between two parallax frames: ${tiles.filter((t) => t.name === name).map((t) => t.crawl.toFixed(2)).join(' / ')}</text></svg>`);
  comps.push({ input: label, left: 0, top: y });
  for (const t of tiles.filter((t) => t.name === name)) {
    comps.push({ input: t.a, left: x, top: y + 40 });
    x += t.c.width * 2 + 20;
  }
  y += crops[0].height * 2 + 40;
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(OUT + 'aa-compare.png');
console.log(tiles.map((t) => `${t.name} crop@${t.c.left},${t.c.top}: change ${t.crawl.toFixed(2)}`).join('\n'));
