/**
 * C1 (08): the LCP posters can never go stale. Their inputs (everything that shapes the booth's
 * first frame: staging, shell, camera, materials, lamps, post chain, models, AO, brand screens) are
 * hashed; tools/make-posters.mjs stores the hash it rendered from in public/booth/posters.json.
 *   node tools/poster-hash.mjs           print the current hash
 *   node tools/poster-hash.mjs --check   exit 1 if the posters were rendered from other inputs
 *                                        (runs before every build: a stale poster never deploys)
 */
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
const ROOT = new URL('../', import.meta.url).pathname;
const FILES = [
  'components/booth/staging.ts', 'components/booth/shell.ts', 'components/booth/shots.ts', 'components/booth/BoothRoom.tsx',
  'components/booth/ObjectSlot.tsx', 'components/booth/Certificate.tsx', 'components/booth/LampRig.tsx', 'components/booth/Post.tsx',
  'components/booth/environment.ts', 'components/booth/imperfections.ts', 'components/booth/deviceScreen.ts', 'components/booth/screens.ts',
  'components/booth/uvMaterial.ts', 'components/booth/phoneStaging.ts', 'lib/lampPresets.ts', 'content/work/index.ts', 'public/booth/ao.png',
  // C0 (09): the room lightmap, every variant a device can be served (the EXR and the 16-bit PNG are
  // sources under assets-src/, never served): a new bake fails the build until the posters are redone
  'public/booth/lightmap.ktx2', 'public/booth/lightmap.png', 'public/booth/lightmap-phone.webp', 'public/booth/ao-phone.png',
  'app/(site)/layout.tsx', 'app/globals.css', 'components/booth/BoothCanvas.tsx', 'lib/views.ts',
  // L (09B): the shapes, the shelf and its AO, the frame's sizing
  'lib/shape.ts', 'components/booth/shelf.ts',
  'components/booth/shelfGeometry.ts', 'components/booth/ShelfUnit.tsx', 'components/booth/BoothFrame.tsx', 'components/booth/CameraRig.tsx',
  'public/booth/ao-shelf2.png', 'public/booth/ao-shelf3.png', 'public/booth/ao-shelf4.png',
];
const DIRS = ['public/models', 'public/brand'];
const walk = (d) => readdirSync(join(ROOT, d)).sort().flatMap((f) => (statSync(join(ROOT, d, f)).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
/** The poster files themselves: a poster swapped by hand (or an old one restored) fails the check too. */
import { POSTERS } from './poster-matrix.mjs';
export { POSTERS };
export function posterFileHashes() {
  return Object.fromEntries(POSTERS.map((f) => [f, existsSync(join(ROOT, 'public/booth', f)) ? createHash('sha256').update(readFileSync(join(ROOT, 'public/booth', f))).digest('hex') : null]));
}
export function posterHash() {
  const h = createHash('sha256');
  for (const f of [...FILES, ...DIRS.flatMap(walk)]) {
    if (!existsSync(join(ROOT, f))) continue;
    h.update(f);
    h.update(readFileSync(join(ROOT, f)));
  }
  return h.digest('hex');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const hash = posterHash();
  if (!process.argv.includes('--check')) console.log(hash);
  else {
    const meta = join(ROOT, 'public/booth/posters.json');
    const m = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : {};
    const at = m.hash ?? null;
    const files = posterFileHashes();
    const changed = POSTERS.filter((f) => !m.files || m.files[f] !== files[f]);
    if (changed.length) {
      console.error(`✗ the booth posters are not the ones make-posters rendered: ${changed.join(', ')}.\n  Run: npm run build && npx next start -p 3100 & then node tools/make-posters.mjs`);
      process.exit(1);
    }
    if (at !== hash) {
      console.error(`✗ the booth posters are stale (rendered from ${at ? at.slice(0, 12) : 'nothing'}, the booth is now ${hash.slice(0, 12)}).\n  Run: npm run build && npx next start -p 3100 & then node tools/make-posters.mjs`);
      process.exit(1);
    }
    console.log(`✓ booth posters match the booth (${hash.slice(0, 12)})`);
  }
}
