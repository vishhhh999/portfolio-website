/**
 * M4 (09): the headline type test as one contact sheet: the home headline and subtext at 1568x980 in
 * the current Geist and the three candidates (?type=a|b|c), two by two.
 *   node tools/type-sheet.mjs   (against a running build) → tools/lamp-review/09/type-sheet.png
 */
import { createRequire } from 'module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/09/type-sheet.png', import.meta.url).pathname;
const b = await pw.chromium.launch();
const shots = [];
const NAMES = { '': 'Current: Geist SemiBold', a: '?type=a  Antonio Bold (condensed grotesk)', b: '?type=b  Instrument Serif (contemporary serif)', c: '?type=c  Archivo Expanded Bold (wide grotesk)' };
for (const t of ['', 'a', 'b', 'c']) {
  const p = await b.newPage({ viewport: { width: 1568, height: 980 } });
  // house lights on: the headline without loading the booth
  await p.addInitScript(() => localStorage.setItem('vm:houseLights:v2', '1'));
  await p.goto(`${BASE}/${t ? `?type=${t}` : ''}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const r = await p.locator('.hero__copy').boundingBox();
  const png = await p.screenshot({ clip: { x: 0, y: 0, width: 1568, height: Math.ceil(r.y + r.height + 40) } });
  const label = Buffer.from(`<svg width="1568" height="44"><rect width="100%" height="100%" fill="#111"/><text x="24" y="29" font-family="monospace" font-size="18" fill="#f2f0ea">${NAMES[t]}</text></svg>`);
  shots.push(await sharp({ create: { width: 1568, height: 44 + 380, channels: 3, background: '#f2f0ea' } }).composite([{ input: label, top: 0, left: 0 }, { input: await sharp(png).resize({ width: 1568, height: 380, fit: 'cover', position: 'top' }).toBuffer(), top: 44, left: 0 }]).png().toBuffer());
  await p.close();
}
await b.close();
await sharp({ create: { width: 1568 * 2 + 16, height: 424 * 2 + 16, channels: 3, background: '#cfcdc6' } })
  .composite(shots.map((s, i) => ({ input: s, left: (i % 2) * (1568 + 16), top: Math.floor(i / 2) * (424 + 16) })))
  .png().toFile(OUT);
console.log(OUT);
