/**
 * The delivery screenshots (J2, J3): the booth under each lamp and the key pages at 1568px and
 * 390px, into tools/lamp-review/review/<label>/. Run against any build (BASE), e.g. the previous
 * commit for the before/after.   LABEL=after node tools/review-shots.mjs
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const LABEL = process.env.LABEL || 'after';
const OUT = new URL(`./lamp-review/review/${LABEL}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const LAMPS = (process.env.LAMPS || 'D50,TL84,A,UV,SCREEN,AFTERDARK').split(',');
const KEYS = { D50: '1', TL84: '2', A: '3', UV: '4', FLOOD: '5', SCREEN: '6', AFTERDARK: '7' };
const PAGES = (process.env.PAGES ?? '/work/too-yumm,/about,/archive').split(',').filter(Boolean);
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
for (const [name, vp, mobile] of [['1568', { width: 1568, height: 980 }, false], ['390', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.setDefaultTimeout(600000);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
  await p.waitForTimeout(3000);
  for (const lamp of LAMPS) {
    await p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), KEYS[lamp]);
    if (lamp === 'AFTERDARK') await p.mouse.move(vp.width * 0.45, vp.height * 0.62);
    await p.waitForTimeout(lamp === 'D50' ? 2500 : 4000);
    await p.screenshot({ path: `${OUT}${name}-home-${lamp}.png` });
    console.log(LABEL, name, lamp);
  }
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })));
  for (const route of PAGES) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    if (route.startsWith('/work/')) await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 }).catch(() => {});
    await p.waitForTimeout(3000);
    const slug = route.replaceAll('/', '-').replace(/^-/, '');
    await p.screenshot({ path: `${OUT}${name}-${slug}.png` });
    await p.screenshot({ path: `${OUT}${name}-${slug}-full.png`, fullPage: true });
    console.log(LABEL, name, route);
  }
  await ctx.close();
}
await b.close();
