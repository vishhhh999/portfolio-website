/**
 * Screenshots the lineup shot under every lamp, desktop 1440 + mobile 390,
 * into tools/lamp-review/. Then: python3 tools/floor-stops.py && python3 tools/contact-sheet.py
 *   npm run build && npx next start -p 3100 &   then   node tools/lamp-review.mjs
 * Needs Playwright (global install is fine): PLAYWRIGHT=/path/to/playwright node tools/lamp-review.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright'); // npm i -D playwright, or point PLAYWRIGHT at an install
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/', import.meta.url).pathname;
const LAMPS = ['D50', 'TL84', 'A', 'UV', 'FLOOD', 'SCREEN', 'AFTERDARK'];
const only = process.argv[2] ? process.argv[2].split(',') : LAMPS;

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  if (process.env.ONLY && process.env.ONLY !== name) continue;
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.on('console', (m) => m.type() === 'error' && errors.push(name + ': ' + m.text()));
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  for (const lamp of only) {
    const i = LAMPS.indexOf(lamp);
    await page.click('.switch >> nth=' + i, { force: true });
    if (lamp === 'AFTERDARK') {
      // aim the hand lamp at the centre of the row
      await page.mouse.move(viewport.width * 0.47, viewport.height * 0.66);
    } else {
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
    }
    await page.waitForTimeout(lamp === 'SCREEN' ? 2500 : 1800);
    const file = OUT + name + '-' + String(i + 1) + '-' + lamp + '.png';
    await page.screenshot({ path: file });
    if (process.env.CLEAN) {
      // the booth alone, without the page overlay
      await page.addStyleTag({ content: '.masthead,.hero,.panel,.footer{visibility:hidden!important}' }).catch(() => {});
      await page.waitForTimeout(200);
      await page.screenshot({ path: file.replace('.png', '-clean.png') });
      await page.addStyleTag({ content: '.masthead,.hero,.panel,.footer{visibility:visible!important}' }).catch(() => {});
    }
  }
  await ctx.close();

  // Too Yumm proof strip under D50, A, UV and AFTER DARK (lit planes need motion allowed + a capable GPU)
  if (!process.env.NOPROOF) {
    const pctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const pp = await pctx.newPage();
    pp.on('pageerror', (e) => errors.push(name + ' proof pageerror: ' + e.message));
    await pp.goto(BASE + '/work/too-yumm?gpu=high', { waitUntil: 'networkidle' });
    await pp.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 60000 });
    await pp.evaluate(() => window.scrollTo(0, document.querySelector('.proofstrip').getBoundingClientRect().top + window.scrollY - 40));
    await pp.waitForFunction(() => document.querySelectorAll('.proof__image [data-lit="true"]').length >= 2, null, { timeout: 60000 }).catch(() => {});
    await pp.waitForTimeout(1500);
    for (const [i, lamp] of [[0, 'D50'], [2, 'A'], [3, 'UV'], [6, 'AFTERDARK']]) {
      if (lamp === 'AFTERDARK') await pp.mouse.move(viewport.width * 0.32, viewport.height * 0.38);
      await pp.click('.switch >> nth=' + i, { force: true }).catch(() => pp.keyboard.press(String(i + 1)));
      if (lamp === 'AFTERDARK') await pp.mouse.move(viewport.width * 0.33, viewport.height * 0.4);
      await pp.waitForTimeout(2500);
      await pp.screenshot({ path: OUT + name + '-proof-' + lamp + '.png' });
    }
    await pctx.close();
  }
}
console.log('errors', errors.length ? errors : 'none');
await browser.close();
