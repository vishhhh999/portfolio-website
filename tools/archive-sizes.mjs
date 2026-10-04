/**
 * Archive contact-sheet sizes: the grid shows each piece at most ~400px wide, so it gets 480w and
 * 960w copies (AVIF + WebP) instead of the full file. Source: the master AVIF when one exists, else
 * the WebP. Output: public/archive/sized/<n>-<w>.{avif,webp}. Re-run after the archive changes.
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync } from 'fs';
const DIR = new URL('../public/archive/', import.meta.url).pathname;
const OUT = DIR + 'sized/';
mkdirSync(OUT, { recursive: true });
const WIDTHS = [480, 960];
const files = readdirSync(DIR).filter((f) => f.endsWith('.webp'));
await Promise.all(
  files.map(async (f) => {
    const n = f.replace('.webp', '');
    const src = existsSync(DIR + n + '.avif') ? DIR + n + '.avif' : DIR + f;
    for (const w of WIDTHS) {
      const img = sharp(src).resize({ width: w, withoutEnlargement: true });
      await img.clone().avif({ quality: 60, effort: 6 }).toFile(`${OUT}${n}-${w}.avif`);
      await img.clone().webp({ quality: 82 }).toFile(`${OUT}${n}-${w}.webp`);
    }
  }),
);
console.log(`${files.length} pieces × ${WIDTHS.join('/')}w → public/archive/sized`);
