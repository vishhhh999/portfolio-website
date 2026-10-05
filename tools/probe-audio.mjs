/**
 * H1 (08): which proof videos carry sound. ffprobe reads every video under public/ that the content
 * references and writes content/audio.json ({ "/work/x/01.mp4": true }); the proof strip offers
 * "Play with sound" only where it is true. Runs before every build; where ffprobe is missing (it
 * is not on every build image) the committed file stands, and a video absent from it counts as silent.
 *   node tools/probe-audio.mjs
 */
import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const out = join(ROOT, 'content/audio.json');
try {
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
} catch {
  console.log(`probe-audio: no ffprobe here, keeping ${existsSync(out) ? 'the committed' : 'an empty'} content/audio.json`);
  if (!existsSync(out)) writeFileSync(out, '{}\n');
  process.exit(0);
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const sources = walk(join(ROOT, 'content')).filter((f) => /\.(ts|tsx|json)$/.test(f) && !f.endsWith('audio.json')).map((f) => readFileSync(f, 'utf8')).join('\n');
const videos = [...new Set([...sources.matchAll(/["'](\/[^"']+\.(?:mp4|webm|mov))["']/g)].map((m) => m[1]))].sort();
const map = {};
for (const v of videos) {
  const file = join(ROOT, 'public', v);
  if (!existsSync(file)) continue;
  const streams = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
  map[v] = streams.length > 0;
}
writeFileSync(out, JSON.stringify(map, null, 2) + '\n');
console.log('probe-audio:', Object.entries(map).map(([k, a]) => `${k} ${a ? 'sound' : 'silent'}`).join(' · '));
