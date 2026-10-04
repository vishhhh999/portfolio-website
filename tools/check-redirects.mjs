/**
 * E7: every live-site /projects/<slug> URL answers 301 to a /work/<slug> page that answers 200.
 *   node tools/check-redirects.mjs   (against a running build)
 */
const BASE = process.env.BASE || 'http://localhost:3100';
const OLD = ['too-yumm', 'mitooshi', 'bengal-t20-league', 'house-of-hex', 'indothai', 'shunya', 'sonde', 'sook', 'jsw-sports'];
let ok = true;
for (const slug of OLD) {
  const r = await fetch(`${BASE}/projects/${slug}`, { redirect: 'manual' });
  const loc = r.headers.get('location') ?? '';
  const target = loc ? await fetch(new URL(loc, BASE), { redirect: 'manual' }) : null;
  const pass = r.status === 301 && /^\/work\//.test(new URL(loc, BASE).pathname) && target?.status === 200;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} /projects/${slug} → ${r.status} ${loc} → ${target?.status ?? '-'}`);
}
process.exit(ok ? 0 : 1);
