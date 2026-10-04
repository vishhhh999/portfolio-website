/**
 * D1: each GLB in the browser beside its Blender reference render, set up the same way (50mm,
 * straight-on, 0.18 grey world, one soft key front-top-left, AgX). Writes
 * tools/lamp-review/model-ref/<slug>.png (left: site, right: assets-src/models/<slug>/<slug>.ref.png).
 *   node tools/model-ref.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/model-ref/', import.meta.url).pathname;
const ROOT = new URL('../', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const slug of ['too-yumm', 'sook', 'jsw-sports', 'shunya']) {
  const p = await b.newPage({ viewport: { width: 800, height: 800 }, reducedMotion: 'reduce' });
  p.setDefaultTimeout(600000);
  await p.goto(`${BASE}/?modelref=${slug}&gpu=high`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.modelref === 'ready');
  await p.waitForTimeout(4000);
  await p.addStyleTag({ content: '.masthead,.hero,.panel,.footer,.booth-poster,.booth-focus{visibility:hidden!important}' });
  await p.waitForTimeout(500);
  const site = `${OUT}${slug}-site.png`;
  await p.screenshot({ path: site });
  execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
a = Image.open('${site}').convert('RGB'); r = Image.open('${ROOT}assets-src/models/${slug}/${slug}.ref.png').convert('RGB').resize((800, 800))
w = Image.new('RGB', (1620, 840), (240, 238, 232)); w.paste(a, (0, 40)); w.paste(r, (820, 40))
d = ImageDraw.Draw(w); d.text((10, 12), 'SITE (browser, AgX)  ${slug}', fill=(17, 17, 17)); d.text((830, 12), 'BLENDER REFERENCE (${slug}.ref.png)', fill=(17, 17, 17))
w.save('${OUT}${slug}.png')
`]);
  console.log(slug);
  await p.close();
}
await b.close();
