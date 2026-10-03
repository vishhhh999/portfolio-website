/**
 * Fails if any app route segment is named "index". Next resolves /index locally, but Vercel's CDN
 * serves /index and /index.rsc from the root page's index.html/.rsc, so such a page silently renders
 * as the home page in production (this is what hid the house-lights list). Run: node tools/check-routes.mjs
 */
import { readdirSync, statSync } from 'fs';
import path from 'path';
const app = new URL('../app', import.meta.url).pathname;
const bad = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.toLowerCase() === 'index') bad.push(path.relative(app, p));
    walk(p);
  }
})(app);
if (bad.length) {
  console.error('Route segments named "index" are not allowed (served as the home page on Vercel):\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('routes ok');
