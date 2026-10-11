/**
 * npm run verify: the whole check, against a production build on port 3100 (started here if none is running).
 *   types · routes · legacy redirects · console errors on every route · axe on four pages · review screenshots
 * Screenshots go to review/latest (SHOTS=0 skips them). Exits non-zero if any step fails.
 */
import { spawn, spawnSync } from 'node:child_process';

const base = process.env.BASE || 'http://localhost:3100';
const up = async () => { try { return (await fetch(base)).ok; } catch { return false; } };
let server = null;
if (!(await up())) {
  server = spawn('npx', ['next', 'start', '-p', '3100'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}
const steps = [
  ['types', 'node', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['routes', 'node', ['tools/check-routes.mjs']],
  ['redirects', 'node', ['tools/check-redirects.mjs']],
  ['console', 'node', ['tools/check-console.mjs']],
  ['axe', 'node', ['tools/check-axe.mjs'], { ROUTES: '/,/work/too-yumm,/about,/archive' }],
  ...(process.env.SHOTS === '0' ? [] : [['shots', 'node', ['tools/shots.mjs', 'review/latest']]]),
];
const results = [];
for (const [name, cmd, args, env = {}] of steps) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, BASE: base, ...env } });
  results.push([name, r.status === 0, ((Date.now() - t0) / 1000).toFixed(0)]);
}
if (server) process.kill(-server.pid);
console.log('\nverify:');
for (const [name, ok, s] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} (${s}s)`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
