import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * Batch 07 screenshots (K5) into tools/lamp-review/07/:
 *   2560x1440, 1568x980, 390x844: / under D50, A, SCREEN and AFTER DARK; / in the Index view;
 *   /work/jsw-sports with the book open; /work/mitooshi; /about; /archive
 *   725x960: / and /work/sonde
 *   jsw-open-sheet.png: 12 frames of the JSW book opening on the tray (clip held at 0..1)
 *   node tools/shots-07.mjs [only]   (against a running build; software rendering is slow)
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/07/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ?? '';
const b = await launch({ args: [] });
const open = async (w, h, url) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: w < 500 ? 2 : 1 });
  p.setDefaultTimeout(timeoutMs());
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  if (await p.locator('.booth-stage').count()) await p.waitForSelector('.booth-stage[data-ready="true"]');
  await p.waitForTimeout(2500);
  return p;
};
const snap = async (p, name, full = false) => {
  await p.screenshot({ path: `${OUT}${name}.png`, fullPage: full, timeout: timeoutMs() });
  console.log(name);
};
const lampKey = { D50: '1', A: '3', SCREEN: '6', AFTERDARK: '7' };
for (const [w, h] of [[2560, 1440], [1568, 980], [390, 844]]) {
  if (only && !only.includes(`${w}`)) continue;
  const tag = `${w}x${h}`;
  const p = await open(w, h, '/');
  for (const lamp of ['D50', 'A', 'SCREEN', 'AFTERDARK']) {
    await p.keyboard.press(lampKey[lamp]);
    if (lamp === 'AFTERDARK') {
      const r = await p.locator('.booth-frame').boundingBox();
      await p.mouse.move(r.x + r.width * 0.42, r.y + r.height * 0.6);
    }
    await p.waitForTimeout(2500);
    await snap(p, `${tag}-home-${lamp}`);
  }
  await p.keyboard.press('1');
  await p.waitForTimeout(800);
  await p.locator('.sitenav > :first-child').click();
  await p.waitForTimeout(600);
  if (w > 500) await p.locator('.homeindex__list a').nth(2).hover();
  await p.waitForTimeout(400);
  await snap(p, `${tag}-home-index`);
  await p.close();
  for (const [url, name, full] of [['/work/jsw-sports', 'jsw-sports-open', false], ['/work/mitooshi', 'mitooshi', true], ['/about', 'about', true], ['/archive', 'archive', false]]) {
    const q = await open(w, h, url);
    if (name === 'jsw-sports-open') await q.waitForTimeout(2500);
    await snap(q, `${tag}-${name}`, full && w < 2000);
    await q.close();
  }
}
if (!only || only.includes('725')) {
  for (const [url, name] of [['/', 'home'], ['/work/sonde', 'sonde']]) {
    const q = await open(725, 960, url);
    await snap(q, `725x960-${name}`);
    await q.close();
  }
}
if (!only || only.includes('sheet')) {
  const q = await open(1568, 980, '/work/jsw-sports');
  const frames = [];
  for (let i = 0; i < 12; i++) {
    // the canvas renders on demand: a resize makes it draw the held frame
    await q.evaluate((v) => {
      window.__boothAnimHold = v;
      window.dispatchEvent(new Event('resize'));
    }, i / 11);
    await q.waitForTimeout(700);
    const f = `${OUT}_sheet-${String(i).padStart(2, '0')}.png`;
    const r = await q.locator('.booth-stage').boundingBox();
    await q.screenshot({ path: f, clip: { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 980 - r.y) }, timeout: timeoutMs() });
    frames.push(f);
  }
  await q.close();
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[1:]
ims=[Image.open(f).convert('RGB') for f in fs]
w,h=ims[0].size; s=0.5; tw,th=int(w*s),int(h*s)
sheet=Image.new('RGB',(tw*4,th*3),'white')
for i,im in enumerate(ims):
  t=im.resize((tw,th)); d=ImageDraw.Draw(t); d.rectangle([0,0,150,26],fill='white'); d.text((6,6),f'{i:02d}  p={i/11:.2f}',fill='black')
  sheet.paste(t,((i%4)*tw,(i//4)*th))
sheet.save('${OUT}jsw-open-sheet.png')
`, ...frames]);
  console.log('jsw-open-sheet');
}
await b.close();
