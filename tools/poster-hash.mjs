/** Grouped first-frame source and output integrity gate. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HOME, SLUGS, TRAY } from './poster-matrix.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const META = join(ROOT, 'public/booth/posters.json');
const MODEL_DIRS = ['public/models', 'public/brand'];
const walk = (dir) => readdirSync(join(ROOT, dir)).sort().flatMap((name) => {
  const rel = dir + '/' + name;
  return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
});
const shared = [
  'components/booth/BoothCanvas.tsx', 'components/booth/BoothRoom.tsx', 'components/booth/BoothHost.tsx',
  'components/booth/BoothFrame.tsx', 'components/booth/CameraRig.tsx', 'components/booth/ObjectSlot.tsx',
  'components/booth/Certificate.tsx', 'components/booth/staging.ts', 'components/booth/shots.ts',
  'components/booth/shell.ts', 'components/booth/Post.tsx', 'components/booth/LampRig.tsx',
  'components/booth/environment.ts', 'components/booth/imperfections.ts', 'components/booth/deviceScreen.ts',
  'components/booth/screens.ts', 'components/booth/uvMaterial.ts', 'lib/lampPresets.ts', 'lib/shape.ts',
  'lib/views.ts', 'app/globals.css', 'app/(site)/layout.tsx', 'content/work/index.ts',
  'public/booth/lightmap.ktx2', 'public/booth/lightmap-phone.webp',
];
const shelfSource = ['components/booth/shelf.ts', 'components/booth/shelfGeometry.ts', 'components/booth/ShelfUnit.tsx'];
const gatheredSource = ['components/booth/phoneStaging.ts', 'public/booth/ao-phone.png'];
const wideSource = ['public/booth/ao.png'];
const cabinet = HOME.find((h) => h.name === 'cabinet');
const shelf = (name) => HOME.find((h) => h.name === name);
const homeFiles = (entry) => [...entry.files, ...entry.dark].map((f) => 'booth/' + f);
const trayFiles = (suffix) => SLUGS.map((slug) => 'booth/tray/' + slug + suffix + '.webp');
const ogFiles = SLUGS.map((slug) => 'og/' + slug + '.jpg');

// layoutKeyFor: home tall uses shelves, while square and tall project headers use
// the gathered cabinet. Only tray-wide uses the wide cabinet arrangement.
export const POSTER_GROUPS = Object.freeze({
  cabinet: { inputs: wideSource, files: [...homeFiles(cabinet), 'og/site.jpg'] },
  shelf2: { inputs: [...shelfSource, 'public/booth/ao-shelf2.png'], files: homeFiles(shelf('shelf2')) },
  shelf3: { inputs: [...shelfSource, 'public/booth/ao-shelf3.png'], files: homeFiles(shelf('shelf3')) },
  shelf4: { inputs: [...shelfSource, 'public/booth/ao-shelf4.png'], files: homeFiles(shelf('shelf4')) },
  'tray-wide': { inputs: [...wideSource, 'app/fonts/geist-sans-subset.woff2', 'app/fonts/geist-mono-subset.woff2'], files: [...trayFiles(''), ...ogFiles] },
  'tray-square': { inputs: gatheredSource, files: trayFiles('-square') },
  'tray-phone': { inputs: gatheredSource, files: trayFiles('-phone') },
  'tray-tablet': { inputs: gatheredSource, files: trayFiles('-tablet') },
});
export const GROUP_NAMES = Object.keys(POSTER_GROUPS);
export const POSTER_FILES = GROUP_NAMES.flatMap((name) => POSTER_GROUPS[name].files);
if (POSTER_FILES.length !== 63 || new Set(POSTER_FILES).size !== 63 || TRAY.length !== 4) throw new Error('Poster group coverage is not 63 unique files');

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function posterFileHashes() {
  return Object.fromEntries(POSTER_FILES.map((file) => [file, existsSync(join(ROOT, 'public', file)) ? sha(readFileSync(join(ROOT, 'public', file))) : null]));
}
export function groupHash(name) {
  const group = POSTER_GROUPS[name];
  if (!group) throw new Error('Unknown poster group: ' + name);
  const hash = createHash('sha256').update('poster-group-v1:' + name);
  const files = [...new Set([...shared, ...group.inputs, ...MODEL_DIRS.flatMap(walk)])].sort();
  for (const file of files) {
    const path = join(ROOT, file);
    if (!existsSync(path)) throw new Error('Missing first-frame input: ' + file);
    hash.update(file).update(readFileSync(path));
  }
  return hash.digest('hex');
}
export const groupHashes = () => Object.fromEntries(GROUP_NAMES.map((name) => [name, groupHash(name)]));
export const readManifest = () => existsSync(META) ? JSON.parse(readFileSync(META, 'utf8')) : {};
export const changedFiles = (meta = readManifest()) => {
  const actual = posterFileHashes();
  return POSTER_FILES.filter((file) => !meta.files || meta.files[file] === null || meta.files[file] !== actual[file]);
};
export const staleGroups = (meta = readManifest()) => {
  const current = groupHashes();
  return GROUP_NAMES.filter((name) => !meta.groups || meta.groups[name] !== current[name]);
};
export function writeManifest(groups, files = posterFileHashes(), extra = {}) {
  writeFileSync(META, JSON.stringify({ groups, files, rendered: new Date().toISOString(), ...extra }, null, 2) + '\n');
}

// One-time upgrade from the 09B global manifest. It accepts the old file hashes
// only when the original global source hash still matches its exact input list.
function legacyHash() {
  const files = [
    'components/booth/staging.ts', 'components/booth/shell.ts', 'components/booth/shots.ts', 'components/booth/BoothRoom.tsx',
    'components/booth/ObjectSlot.tsx', 'components/booth/Certificate.tsx', 'components/booth/LampRig.tsx', 'components/booth/Post.tsx',
    'components/booth/environment.ts', 'components/booth/imperfections.ts', 'components/booth/deviceScreen.ts', 'components/booth/screens.ts',
    'components/booth/uvMaterial.ts', 'components/booth/phoneStaging.ts', 'lib/lampPresets.ts', 'content/work/index.ts', 'public/booth/ao.png',
    'public/booth/lightmap.ktx2', 'public/booth/lightmap.png', 'public/booth/lightmap-phone.webp', 'public/booth/ao-phone.png',
    'app/(site)/layout.tsx', 'app/globals.css', 'components/booth/BoothCanvas.tsx', 'lib/views.ts', 'lib/shape.ts',
    'components/booth/shelf.ts', 'components/booth/shelfGeometry.ts', 'components/booth/ShelfUnit.tsx',
    'components/booth/BoothFrame.tsx', 'components/booth/CameraRig.tsx',
    'public/booth/ao-shelf2.png', 'public/booth/ao-shelf3.png', 'public/booth/ao-shelf4.png',
  ];
  const hash = createHash('sha256');
  for (const file of [...files, ...MODEL_DIRS.flatMap(walk)]) if (existsSync(join(ROOT, file))) hash.update(file).update(readFileSync(join(ROOT, file)));
  return hash.digest('hex');
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const meta = readManifest();
  if (process.argv.includes('--migrate')) {
    const actual = posterFileHashes();
    const mismatched = POSTER_FILES.filter((file) => file.startsWith('booth/') && meta.files?.[file.slice(6)] !== actual[file]);
    if (meta.hash !== legacyHash() || mismatched.length || POSTER_FILES.some((file) => actual[file] === null)) {
      console.error('Legacy poster sources or files differ; render the stale groups instead.');
      process.exit(1);
    }
    writeManifest(groupHashes(), actual, { migratedFrom: meta.hash });
    console.log('Migrated 63 poster and share-card integrity hashes into eight groups');
  } else if (process.argv.includes('--check')) {
    const swapped = changedFiles(meta), stale = staleGroups(meta);
    if (swapped.length) console.error('Poster files missing or swapped: ' + swapped.join(', '));
    if (stale.length) console.error('Stale poster groups: ' + stale.join(', '));
    if (swapped.length || stale.length) process.exit(1);
    console.log('Poster groups current: ' + GROUP_NAMES.join(', '));
  } else if (process.argv.includes('--restamp')) {
    const swapped = changedFiles(meta), stale = staleGroups(meta);
    if (swapped.length) {
      console.error('Cannot restamp changed poster files: ' + swapped.join(', ') + '. Re-render.');
      process.exit(1);
    }
    if (!stale.length) console.log('No stale poster groups');
    else {
      console.log('Comparing stale groups before restamp: ' + stale.join(', '));
      const run = spawnSync(process.execPath, ['tools/check-poster.mjs'], { cwd: ROOT, env: { ...process.env, CHECK_GROUPS: stale.join(',') }, stdio: 'inherit' });
      if (run.status !== 0) {
        console.error('Poster comparison failed. No hashes changed; re-render the stale groups.');
        process.exit(1);
      }
      writeManifest({ ...meta.groups, ...Object.fromEntries(stale.map((name) => [name, groupHash(name)])) }, meta.files, { restamped: new Date().toISOString() });
      console.log('Restamped pixel-matched groups: ' + stale.join(', '));
    }
  } else console.log(JSON.stringify(groupHashes(), null, 2));
}
