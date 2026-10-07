/**
 * P11 (09): each archive still's dominant colour and a tiny blur-up (16px wide WebP, inline), so a
 * tile is never a blank box while its image loads. Writes content/archive-lqip.json.
 *   node tools/archive-lqip.mjs
 */
import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const out = {};
for (const f of readdirSync(ROOT + 'public/archive').filter((f) => f.endsWith('.webp')).sort()) {
  const img = sharp(ROOT + 'public/archive/' + f);
  const { dominant } = await img.clone().stats();
  const tiny = await img.clone().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  out[`/archive/${f}`] = { c: `rgb(${dominant.r},${dominant.g},${dominant.b})`, q: `data:image/webp;base64,${tiny.toString('base64')}` };
}
for (const f of readdirSync(ROOT + 'public/archive/clips').filter((f) => f.endsWith('.webp') && !f.includes('-480'))) {
  const img = sharp(ROOT + 'public/archive/clips/' + f);
  const { dominant } = await img.clone().stats();
  const tiny = await img.clone().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  out[`/archive/clips/${f}`] = { c: `rgb(${dominant.r},${dominant.g},${dominant.b})`, q: `data:image/webp;base64,${tiny.toString('base64')}` };
}
writeFileSync(ROOT + 'content/archive-lqip.json', JSON.stringify(out) + '\n');
console.log(Object.keys(out).length, 'tiles', Math.round(JSON.stringify(out).length / 1024), 'KB');
