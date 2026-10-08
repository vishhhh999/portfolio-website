/**
 * I (09): the project covers (assets-src/covers/<slug>.png, 1440x2000, 18:25) for the web: AVIF and
 * WebP at 480, 960 and 1440 wide into public/covers/<slug>-<w>.{avif,webp}, for srcset. The source
 * PNGs stay in assets-src only. bengal-t20-league.png is the slug bengal-t20.
 *   node tools/cover-sizes.mjs
 */
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SRC = ROOT + 'assets-src/covers/';
const OUT = ROOT + 'public/covers/';
mkdirSync(OUT, { recursive: true });
const SLUG = { 'bengal-t20-league': 'bengal-t20' };
const WIDTHS = [480, 960, 1440];
const report = {};
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()) {
  const name = f.replace(/\.png$/, '');
  const slug = SLUG[name] ?? name;
  const meta = await sharp(SRC + f).metadata();
  report[slug] = { source: `${meta.width}x${meta.height}` };
  for (const w of WIDTHS) {
    const img = sharp(SRC + f).resize({ width: w, kernel: 'lanczos3' }).toColourspace('srgb');
    await img.clone().avif({ quality: 58, effort: 6, chromaSubsampling: '4:4:4' }).toFile(`${OUT}${slug}-${w}.avif`);
    await img.clone().webp({ quality: 82, effort: 6 }).toFile(`${OUT}${slug}-${w}.webp`);
    report[slug][w] = { avifKB: Math.round(statSync(`${OUT}${slug}-${w}.avif`).size / 1024), webpKB: Math.round(statSync(`${OUT}${slug}-${w}.webp`).size / 1024) };
  }
  console.log(slug, JSON.stringify(report[slug]));
}
writeFileSync(ROOT + 'tools/covers-report.json', JSON.stringify(report, null, 2) + '\n');
