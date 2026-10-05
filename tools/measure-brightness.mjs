/**
 * B5: the loupe readings. CIE L* (D50 white) of the back wall and of the certificate's white paper,
 * 9×9 px median around each probe point on the presented frame, per lamp, at 1568×980.
 *   node tools/measure-brightness.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const LAMPS = (process.env.LAMPS || 'D50,TL84,A,FLOOD').split(',');
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1568, height: 980 }, reducedMotion: 'reduce' });
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 180000 });
await p.waitForTimeout(1500);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const Lstar = (r, g, bl) => {
  // sRGB → XYZ (D65) → Bradford to D50 is close enough on neutrals; L* from Y
  const Y = 0.2126729 * lin(r / 255) + 0.7151522 * lin(g / 255) + 0.072175 * lin(bl / 255);
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (24389 / 27) * Y;
};
const out = {};
for (const lamp of LAMPS) {
  await p.keyboard.press({ D50: '1', TL84: '2', A: '3', UV: '4', FLOOD: '5', SCREEN: '6' }[lamp]);
  await p.waitForTimeout(2500);
  const pts = await p.evaluate(() => window.__boothProbePoints());
  const png = await p.screenshot({ timeout: 180000 });
  const vals = await p.evaluate(async ({ data, pts }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const r = {};
    for (const [k, pt] of Object.entries(pts)) {
      const d = g.getImageData(Math.round(pt.x) - 4, Math.round(pt.y) - 4, 9, 9).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      r[k] = px;
    }
    return r;
  }, { data: png.toString('base64'), pts });
  out[lamp] = {};
  for (const [k, px] of Object.entries(vals)) {
    const ls = px.map(([r, g, bl]) => Lstar(r, g, bl)).sort((a, b) => a - b);
    out[lamp][k] = +ls[Math.floor(ls.length / 2)].toFixed(1);
  }
  console.log(lamp, JSON.stringify(out[lamp]));
}
await b.close();
