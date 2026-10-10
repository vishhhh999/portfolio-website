import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * Batch 08 screenshots (I) into tools/lamp-review/08/shots/ (JPEG q88):
 *   2560x1440, 1568x980, 390x844: / under D50, A, SCREEN and AFTER DARK; / with a hover (desktop:
 *   the laptop; phone: a swipe to the next sample); /work/mitooshi, /work/jsw-sports (open),
 *   /work/shunya, /work/indo-thai
 *   reveal-sheet.jpg: 12 captures of the cabinet frame from first paint (poster, crossfade, live)
 *   node tools/shots-08.mjs [only: 2560|1568|390|reveal]   (against a running build; slow in software)
 */
import { createRequire } from 'module';
import { mkdirSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/08/shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ?? '';
const b = await launch({ args: [] });
const open = async (w, h, url) => {
  const phone = w < 600;
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  p.setDefaultTimeout(timeoutMs());
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await p.goto(BASE + url + (url.includes('?') ? '&' : '?') + 'gpu=high', { waitUntil: 'networkidle' });
  if (await p.locator('.booth-stage').count()) await p.waitForSelector('.booth-stage[data-ready="true"]');
  await p.waitForTimeout(3000);
  return p;
};
const snap = async (p, name) => {
  const png = await p.screenshot({ timeout: timeoutMs() });
  await sharp(png).jpeg({ quality: 88 }).toFile(`${OUT}${name}.jpg`);
  console.log(name);
};
const key = (p, k) => p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), k);
const lampKey = { D50: '1', A: '3', SCREEN: '6', AFTERDARK: '7' };
for (const [w, h] of [[2560, 1440], [1568, 980], [390, 844]]) {
  if (only && !only.includes(`${w}`)) continue;
  const tag = `${w}x${h}`;
  const jswOnly = only.includes('jsw');
  const p = jswOnly ? null : await open(w, h, '/');
  if (!jswOnly) {
    for (const lamp of ['D50', 'A', 'SCREEN', 'AFTERDARK']) {
      await key(p, lampKey[lamp]);
      if (lamp === 'AFTERDARK' && w > 600) {
        const r = await p.locator('.booth-frame').boundingBox();
        await p.mouse.move(r.x + r.width * 0.42, r.y + r.height * 0.6, { steps: 4 });
      }
      await p.waitForTimeout(4000);
      await snap(p, `${tag}-home-${lamp}`);
    }
    await key(p, '1');
    await p.waitForTimeout(3000);
    if (w > 600) {
      const { boxes } = await p.evaluate(() => window.__boothBoxes());
      const r = boxes.mitooshi;
      await p.mouse.move((r.x0 + r.x1) / 2 - 30, (r.y0 + r.y1) / 2 - 30);
      await p.mouse.move((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, { steps: 6 });
      await p.waitForFunction(() => document.querySelector('.specchip[data-visible="true"]'));
      await p.waitForTimeout(2500);
      await snap(p, `${tag}-home-hover-mitooshi`);
    } else {
      await p.evaluate(() => document.querySelectorAll('.booth-swipe__btn')[1]?.click());
      await p.waitForTimeout(2500);
      await snap(p, `${tag}-home-swipe`);
    }
    await p.close();
  }
  for (const slug of jswOnly ? ['jsw-sports'] : ['mitooshi', 'jsw-sports', 'shunya', 'indo-thai']) {
    const q = await open(w, h, `/work/${slug}`);
    if (slug === 'jsw-sports') {
      // the open clip held fully open (software rendering advances it ≤ 0.1s per frame)
      await q.evaluate(() => {
        window.__boothAnimHold = 1;
        window.dispatchEvent(new Event('resize'));
      });
      await q.waitForTimeout(5000);
    }
    await snap(q, `${tag}-work-${slug}`);
    await q.close();
  }
}
if (!only || only.includes('reveal')) {
  // the first-visit reveal (I7): poster (the first-visit, tubes-off poster) → crossfade → tube strike. Two captures of the poster while
  // the booth loads; the real 300ms CSS crossfade held at 0, 100, 200 and 300ms (the booth dark, the
  // strike held at its start); then the D50 strike held at six points to full. Software rendering can
  // present neither in real time, so both are paused and stepped (Web Animations API,
  // window.__boothStrikeHold)
  const p = await b.newPage({ viewport: { width: 1568, height: 980 } });
  p.setDefaultTimeout(timeoutMs());
  await p.addInitScript(() => {
    window.__boothStrikeHold = 0;
    // the 300ms crossfade stretched 1000× so it can be held (software rendering would finish it
    // between two frames); it is stepped at the matching points below
    const st = document.createElement('style');
    st.textContent = '.booth-poster{transition-duration:300s!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
    // polled every frame (an observer set up here would run before <html> exists)
    const watch = () => {
      if (document.documentElement?.hasAttribute('data-booth-ready')) {
        window.__fadeHeld = true;
        requestAnimationFrame(() => document.getAnimations().forEach((a) => (a.pause(), (a.currentTime = 0))));
      } else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  const t0 = Date.now();
  await p.goto(BASE + '/?gpu=high', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.booth-frame');
  await p.waitForFunction(() => document.querySelector('.booth-poster img')?.complete);
  const r = await p.locator('.booth-frame').boundingBox();
  const clip = { x: r.x, y: r.y, width: r.width, height: r.height };
  const pick = [];
  for (let i = 0; i < 2; i++) {
    if (await p.evaluate(() => window.__fadeHeld === true)) break;
    pick.push({ png: await p.screenshot({ clip }), t: Date.now() - t0, label: 'poster, loading' });
    await p.waitForTimeout(2500);
  }
  await p.waitForFunction(() => window.__fadeHeld === true, null, { timeout: timeoutMs() });
  const readyAt = Date.now() - t0;
  await p.waitForTimeout(1500);
  const redraw = () => p.evaluate(() => window.dispatchEvent(new Event('resize')));
  for (const ms of [0, 100, 200, 300]) {
    await p.evaluate((ms) => document.getAnimations().forEach((a) => (a.currentTime = ms * 1000)), ms);
    await redraw();
    await p.waitForTimeout(1500);
    pick.push({ png: await p.screenshot({ clip }), t: ms, label: `crossfade ${ms}ms` });
  }
  await p.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  for (const s of [0.12, 0.25, 0.4, 0.55, 0.75, 1]) {
    await p.evaluate((s) => (window.__boothStrikeHold = s), s);
    await redraw();
    await p.waitForTimeout(2500);
    pick.push({ png: await p.screenshot({ clip }), t: s, label: `strike ${Math.round(s * 100)}%` });
  }
  await p.evaluate(() => (window.__boothStrikeHold = undefined));
  await p.close();
  const caps = pick;
  const dir = `${OUT}_reveal/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const [i, c] of pick.entries()) {
    const f = `${dir}${String(i).padStart(2, '0')}_${c.label.replaceAll(' ', '_').replace(',', '').replace('%', 'pc')}${c.label.startsWith('poster') ? `_${c.t}ms` : ''}.png`;
    await sharp(c.png).toFile(f);
    files.push(f);
  }
  execFileSync('python3', ['-c', `
import sys, os
from PIL import Image, ImageDraw
fs=sys.argv[1:]
ims=[Image.open(f).convert('RGB') for f in fs]
w,h=ims[0].size; s=0.4; tw,th=int(w*s),int(h*s)
sheet=Image.new('RGB',(tw*4,th*3),'white')
for i,(im,f) in enumerate(zip(ims,fs)):
  t=im.resize((tw,th)); d=ImageDraw.Draw(t); lab=os.path.basename(f)[:-4].replace('_',' '); d.rectangle([0,0,8+7*len(lab),22],fill='white'); d.text((6,5),lab,fill='black')
  sheet.paste(t,((i%4)*tw,(i//4)*th))
sheet.save('${OUT}reveal-sheet.jpg', quality=88)
`, ...files]);
  console.log(`reveal-sheet (booth ready ${readyAt}ms after navigation, ${caps.length} frames)`);
}
await b.close();
