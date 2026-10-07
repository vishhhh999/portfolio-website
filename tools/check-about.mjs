/**
 * J (09): the About certificate. At 1440 to 2560 wide the record column (right) ends level with the
 * portrait caption (left), within 24px, and no gap between its sections is more than 2x another.
 * At 390, 768 and 1024 it only has to fit (no horizontal scroll). Clients: 4 columns from 1100px,
 * 3 on tablets, 2 on phones.
 *   node tools/check-about.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch();
let fails = 0;
for (const w of [390, 768, 1024, 1440, 1920, 2560]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto(BASE + '/about', { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const left = document.querySelector('.cert__portrait figcaption').getBoundingClientRect().bottom;
    const col = document.querySelector('.cert__col--record');
    const kids = [...col.children].map((c) => c.getBoundingClientRect());
    const gaps = kids.slice(1).map((k, i) => k.top - kids[i].bottom);
    const cols = getComputedStyle(document.querySelector('.cert__clients')).gridTemplateColumns.split(' ').length;
    return { left, right: kids[kids.length - 1].bottom, gaps, cols, scroll: document.documentElement.scrollWidth > innerWidth };
  });
  const wantCols = w >= 1100 ? 4 : w >= 640 ? 3 : 2;
  const bad = [];
  if (r.scroll) bad.push('horizontal scroll');
  if (r.cols !== wantCols) bad.push(`clients ${r.cols} columns (want ${wantCols})`);
  if (w >= 1440) {
    if (Math.abs(r.right - r.left) > 24) bad.push(`record ends ${Math.round(r.right - r.left)}px from the caption`);
    const g = r.gaps.filter((x) => x > 0);
    if (g.length && Math.max(...g) > 2 * Math.min(...g)) bad.push(`gaps ${g.map(Math.round).join('/')} (one more than 2x another)`);
  }
  fails += bad.length;
  console.log(`${bad.length ? '✗' : '✓'} ${w}: record bottom ${Math.round(r.right)} vs caption ${Math.round(r.left)}, gaps ${r.gaps.map(Math.round).join('/')}, clients ${r.cols} cols${bad.length ? ' · ' + bad.join('; ') : ''}`);
  await p.close();
}
await b.close();
process.exit(fails ? 1 : 0);
