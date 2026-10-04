/**
 * A5: routes never change the lamp. Every /work/* route loads fresh in D50; a visitor's pick
 * (UV) survives client-side navigation to another project and a full reload in the same session.
 *   node tools/check-lamp.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const SLUGS = ['too-yumm', 'jsw-sports', 'mitooshi', 'sonde', 'house-of-hex', 'bengal-t20', 'sook', 'shunya', 'indo-thai'];
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
const active = (p) => p.evaluate(() => document.querySelector('.switch[aria-pressed="true"]')?.getAttribute('aria-label') ?? null);
const check = (label, got, want) => {
  const pass = got === want;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${got} (want ${want})`);
};
for (const slug of SLUGS) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  await p.goto(`${BASE}/work/${slug}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500); // anything that would switch the lamp after load has had its chance
  // archive-only projects have no booth, so no lamp panel at all (B4)
  check(`fresh /work/${slug}`, await active(p), slug === 'indo-thai' ? null : 'Daylight, D50');
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  await p.goto(`${BASE}/work/too-yumm`, { waitUntil: 'networkidle' });
  await p.keyboard.press('4'); // UV
  await p.waitForTimeout(300);
  check('after pressing 4', await active(p), 'Blacklight, UV');
  // a DOM click on "Next on the tray" (the floating lamp bar may sit over it at this viewport)
  await p.evaluate(() => document.querySelector('a.next')?.click());
  await p.waitForURL((u) => !u.pathname.endsWith('/too-yumm'), { timeout: 120000 });
  await p.waitForTimeout(1500);
  check(`client nav to ${new URL(p.url()).pathname}`, await active(p), 'Blacklight, UV');
  await p.goto(`${BASE}/work/mitooshi`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  check('reload /work/mitooshi in the same session', await active(p), 'Blacklight, UV');
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  check('home in the same session', await active(p), 'Blacklight, UV');
  // the native-lamp chip is a manual pick
  await p.goto(`${BASE}/work/too-yumm`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelector('.lampchip').click()); // a DOM click: SwiftShader keeps the main thread busy
  await p.waitForTimeout(300);
  check('native lamp chip on too-yumm', await active(p), 'Store light, TL84');
  await ctx.close();
}
await b.close();
process.exit(ok ? 0 : 1);
