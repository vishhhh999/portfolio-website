/** Fast, changed-file and complete verification tiers against a production server. */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { GROUP_NAMES, POSTER_GROUPS, groupInputs } from './poster-hash.mjs';

const root = new URL('../', import.meta.url).pathname;
const base = process.env.BASE || 'http://localhost:3100';
const tier = process.argv.find((arg) => ['fast', 'affected', 'full'].includes(arg)) || 'fast';
const bail = process.argv.includes('--bail');
const map = JSON.parse(readFileSync(join(root, 'tools/checks-map.json'), 'utf8'));
const jobs = process.env.JOBS === undefined ? 3 : Number(process.env.JOBS);
if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('JOBS must be a positive integer');
const env = { ...process.env, BASE: base, ...(tier === 'full' ? { SIZES: 'all' } : {}) };
if (!env.PLAYWRIGHT && existsSync('/tmp/booth-playwright.cjs')) env.PLAYWRIGHT = '/tmp/booth-playwright.cjs';

const fast = ['tsc', 'check-routes', 'poster-hash', 'check-shape', 'check-targets', 'check-redirects'];
const full = [
  'check-poster', 'check-flicker', 'check-smear', 'check-redirects', 'check-about', 'check-shape',
  'check-pill', 'check-shapes', 'check-views', 'check-layout', 'check-sizes', 'check-picking',
  'check-overflow', 'check-houselights', 'check-lamp', 'check-switch', 'check-sound', 'check-07',
  'check-targets', 'check-axe', 'check-console', 'shots-09b', 'transfer-sizes', 'metrics',
].filter((name) => existsSync(join(root, 'tools', name + '.mjs')));
const toolPath = (name) => name === 'tsc' ? 'node_modules/typescript/bin/tsc' : name === 'poster-hash' ? 'tools/poster-hash.mjs' : 'tools/' + name + '.mjs';
const argsFor = (name) => [toolPath(name), ...(name === 'tsc' ? ['--noEmit'] : name === 'poster-hash' ? ['--check'] : [])];
const changed = () => {
  let files = [];
  try { files = execFileSync('git', ['diff', '--name-only', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean); }
  catch { files = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean); }
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  return [...new Set([...files, ...untracked])];
};
const matches = (glob, file) => {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp('^' + escaped + '$').test(file);
};
const posterGroupsFor = (files) => GROUP_NAMES.filter((name) => files.some((file) =>
  groupInputs(name).includes(file) || POSTER_GROUPS[name].files.some((poster) => file === 'public/' + poster)));

let selected = [...fast];
let changedFiles = [];
if (tier === 'full') selected = [...new Set([...fast, ...full])];
if (tier === 'affected') {
  changedFiles = changed();
  const additions = new Set();
  let unknown = false;
  for (const file of changedFiles) {
    const rules = map.rules.filter((rule) => rule.globs.some((glob) => matches(glob, file)));
    if (!rules.length) unknown = true;
    for (const rule of rules) for (const check of rule.checks) additions.add(check);
  }
  selected = unknown ? [...new Set([...fast, ...full])] : [...new Set([...fast, ...additions])];
  console.log('Changed paths: ' + (changedFiles.join(', ') || '(none)'));
  if (unknown) console.log('An unmapped path requires the full tier');
}

async function serverReady() {
  try { if ((await fetch(base)).ok) return; } catch {}
  if (base !== 'http://localhost:3100') throw new Error('No production server at ' + base);
  const fd = openSync('/tmp/booth-next-start.log', 'a');
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100'], { cwd: root, env, detached: true, stdio: ['ignore', fd, fd] });
  child.unref(); closeSync(fd);
  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    try { if ((await fetch(base)).ok) return; } catch {}
  }
  throw new Error('Production server did not start on ' + base);
}
await serverReady();
const posterGroups = posterGroupsFor(changedFiles);
const tasks = selected.map((name) => ({ name, args: argsFor(name), extra: name === 'check-targets' ? { SIZES: tier === 'full' ? 'all' : 'desktop,phone' }
  : name === 'check-poster' && tier === 'affected' && posterGroups.length ? { CHECK_GROUPS: posterGroups.join(',') }
  : name === 'check-flicker' && tier === 'affected' ? { ONLY: 'reveal,resize' } : {} }));
const results = [];
let stop = false;
async function run(task) {
  const start = performance.now();
  const output = [];
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, task.args, { cwd: root, env: { ...env, ...task.extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => output.push(chunk.toString()));
    child.on('error', (error) => { output.push(error.message); resolve(1); });
    child.on('exit', (code) => resolve(code ?? 1));
  });
  const row = { tool: task.name, seconds: Math.round((performance.now() - start) / 100) / 10, status: code === 0 ? 'PASS' : 'FAIL', output: output.join('') };
  results.push(row);
  console.log(row.status + ' ' + row.tool + ' ' + row.seconds.toFixed(1) + 's');
  if (code && bail) stop = true;
}
const started = performance.now();
const serial = tasks.filter((task) => map.serial.includes(task.name));
const queue = tasks.filter((task) => !map.serial.includes(task.name));
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length && !stop) await run(queue.shift());
}));
for (const task of serial) if (!stop) await run(task);
results.sort((a, b) => selected.indexOf(a.tool) - selected.indexOf(b.tool));
const total = Math.round((performance.now() - started) / 100) / 10;
const lines = ['Tool | Seconds | Result', '--- | ---: | ---', ...results.map((row) => row.tool + ' | ' + row.seconds.toFixed(1) + ' | ' + row.status), 'Total | ' + total.toFixed(1) + ' | ' + (results.every((row) => row.status === 'PASS') && results.length === tasks.length ? 'PASS' : 'FAIL')];
console.log('\n' + lines.join('\n'));
writeFileSync(join(root, 'suite.log'), lines.join('\n') + '\n\n' + results.map((row) => '## ' + row.tool + '\n' + row.output).join('\n'));
process.exit(results.every((row) => row.status === 'PASS') && results.length === tasks.length ? 0 : 1);
