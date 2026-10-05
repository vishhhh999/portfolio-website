/**
 * C1: what WebGL draws must land exactly on its DOM rect. Screenshots the page with a debug colour
 * and finds the coloured region; every edge must be within 2px. Widths 1280, 1568, 1920, 2560
 * (DPR 1, classic 15px scrollbars on, so innerWidth and clientWidth differ).
 *   project pages: the booth stage (?viewdebug: the stage rect painted solid) vs .booth-stage
 *   home:          the cabinet (?viewdebug=cabinet: the booth's opaque silhouette) vs .booth-frame: the
 *                  camera contain-fits the cabinet's outline into the box, centred, standing on its
 *                  floor: bottom on the box's bottom, and either both sides on the box's sides or the
 *                  top on its top with the outline centred
 *   node tools/check-views.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// 2px, or 0.1% of the width on very wide screens (the fit is solved on the face plane; the chamfered
// frame's projected outline differs from it by a fraction of a pixel per 1000px)
const tolFor = (w) => Math.max(2, w * 0.001);
let ok = true;
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/work/too-yumm'];
for (const route of routes) {
  // [width, height, loadedAt]: the last cases load at one size and are then resized (a window maximised after load)
  for (const [w, h, from] of [[1280, 800], [1568, 980], [1920, 1080], [2560, 1271], [2560, 1271, [1920, 1080]], [1280, 800, [2560, 1271]]]) {
    const p = await b.newPage({ viewport: from ? { width: from[0], height: from[1] } : { width: w, height: h }, reducedMotion: 'reduce' });
    const home = route === '/';
    await p.goto(BASE + route + (home ? '?viewdebug=cabinet' : '?viewdebug') + '&gpu=high', { waitUntil: 'networkidle' });
    await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 180000 });
    if (from) {
      await p.waitForTimeout(400);
      await p.setViewportSize({ width: w, height: h });
    }
    await p.waitForTimeout(600);
    // the home frame is sized by script (C2): wait until it has settled at this size
    for (let i = 0, last = ''; i < 40; i++) {
      const now = await p.evaluate(() => JSON.stringify(document.querySelector('.booth-frame, .booth-stage')?.getBoundingClientRect()));
      if (now === last) break;
      last = now;
      await p.waitForTimeout(500);
    }
    const dom = await p.evaluate((home) => {
      const sb = innerWidth - document.documentElement.clientWidth;
      if (home) {
        const r = document.querySelector('.booth-frame').getBoundingClientRect();
        return { home: true, left: r.left, right: r.right, top: r.top, bottom: Math.min(innerHeight, r.bottom), sb };
      }
      const r = document.querySelector('.booth-stage').getBoundingClientRect();
      // the stage clipped to the viewport (what can be drawn)
      const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
      return { left: r.left, right: Math.min(r.right, document.documentElement.clientWidth), top, bottom, sb };
    }, home);
    const png = await p.screenshot({ timeout: 300000 });
    const found = await p.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      // magenta under any tone curve: red and blue high and close, green well below both
      const hit = (i) => d[i] > 120 && d[i + 2] > 120 && Math.abs(d[i] - d[i + 2]) < 40 && d[i + 1] < 0.7 * Math.min(d[i], d[i + 2]);
      let l = 1e9, r = -1, t = 1e9, bt = -1;
      for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
        if (!hit((y * c.width + xx) * 4)) continue;
        if (xx < l) l = xx; if (xx > r) r = xx; if (y < t) t = y; if (y > bt) bt = y;
      }
      return r < 0 ? null : { left: l, right: r + 1, top: t, bottom: bt + 1 };
    }, png.toString('base64'));
    let err = Infinity;
    if (found && dom.home) {
      // contain-fit: bottom on the floor of the box; width-filled or height-filled and centred
      const bottom = Math.abs(found.bottom - dom.bottom);
      const sides = Math.max(Math.abs(found.left - dom.left), Math.abs(found.right - dom.right));
      const topCentre = Math.max(Math.abs(found.top - dom.top), Math.abs((found.left + found.right) / 2 - (dom.left + dom.right) / 2));
      err = Math.max(bottom, Math.min(sides, topCentre));
    } else if (found) err = Math.max(...['left', 'right', 'top', 'bottom'].map((k) => Math.abs(found[k] - dom[k])));
    const pass = err <= tolFor(w);
    if (!pass) ok = false;
    const f = (o) => o ? `${Math.round(o.left)},${Math.round(o.top)} → ${Math.round(o.right)},${Math.round(o.bottom)}` : 'none';
    console.log(`${pass ? 'PASS' : 'FAIL'} ${route} ${w}x${h}${from ? ` (resized from ${from.join('x')})` : ''}  dom ${f(dom)}  drawn ${f(found)}  max edge error ${err === Infinity ? '∞' : err.toFixed(1)}px  (scrollbar ${dom.sb}px)`);
    await p.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
