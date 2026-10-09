/**
 * Batch 07 page checks (DOM only, no WebGL needed):
 *   nav      on "/" the first nav item reads "Index", swaps to the Index view in place (URL stays
 *            "/", the list shows, the booth goes) and then reads "3D viewport" and swaps back;
 *            on every other page it reads "Home" and links to "/"
 *   clock    /about: LOCATION reads "India" + HH:MM IST, the time in Asia/Kolkata (±1 min), no
 *            hydration warning; no "Open to remote roles", no PASS strip
 *   mitooshi /work/mitooshi has 5 deliverables (04 and 05 the loops, MP4 + WebM), and nothing
 *            anywhere references the old 04-07 files
 *   archive  captions A01..An with no gaps, the given titles at their places, the AMG clips right
 *            after the AMG stills, and the chips filter (kept in ?series=)
 *   node tools/check-07.mjs   (against a running build)
 */
import { createRequire } from 'module';
import { existsSync, readFileSync, readdirSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const page = async (url, w = 1568, h = 980) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const logs = [];
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(m.text()));
  p.on('pageerror', (e) => logs.push(e.message));
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  return { p, logs };
};

// ── nav + home view ──
{
  const { p } = await page('/');
  const item = p.locator('.sitenav > :first-child');
  check('nav on "/" reads Index', (await item.innerText()).trim().toLowerCase() === 'index');
  await item.click();
  await p.waitForFunction(() => document.documentElement.hasAttribute('data-home-index'), null, { timeout: 60000 });
  await p.waitForTimeout(400);
  const listShown = await p.locator('.homeindex').isVisible();
  const boothGone = !(await p.locator('.booth-frame-wrap').isVisible());
  const rows = await p.locator('.homeindex__list li').count();
  check('Index swaps the home view in place', new URL(p.url()).pathname === '/' && listShown && boothGone && rows >= 9, `url ${new URL(p.url()).pathname}, list ${listShown}, booth hidden ${boothGone}, ${rows} rows`);
  check('then it reads 3D viewport', (await item.innerText()).trim().toLowerCase() === '3d viewport');
  await p.locator('.homeindex__list a').first().hover();
  await p.waitForTimeout(300);
  check('hover shows an image preview', (await p.locator('.homeindex__preview img[data-on="true"]').count()) === 1);
  await item.click();
  // BoothHost commits the visibility attribute in an effect. Wait for that commit, rather
  // than counting a fixed delay while the software renderer can occupy the main thread.
  await p.waitForFunction(() => !document.documentElement.hasAttribute('data-home-index'), null, { timeout: 60000 });
  await p.waitForTimeout(400);
  check('3D viewport swaps back', (await p.locator('.booth-frame-wrap').isVisible()) && !(await p.locator('.homeindex').isVisible()) && new URL(p.url()).pathname === '/');
  await p.close();
  for (const url of ['/about', '/archive', '/work/sonde']) {
    const { p: q } = await page(url);
    const first = q.locator('.sitenav > :first-child');
    check(`nav on ${url} reads Home → /`, (await first.innerText()).trim().toLowerCase() === 'home' && (await first.getAttribute('href')) === '/');
    await q.close();
  }
}

// ── IST clock ──
{
  const { p, logs } = await page('/about');
  await p.waitForTimeout(800);
  const where = (await p.locator('.cert__where').innerText()).replace(/\s+/g, ' ').trim();
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const m = where.match(/^India (\d{2}):(\d{2}) IST$/i);
  const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const diff = m ? Math.min(Math.abs(toMin(`${m[1]}:${m[2]}`) - toMin(now)), 1440 - Math.abs(toMin(`${m[1]}:${m[2]}`) - toMin(now))) : 99;
  check('LOCATION reads India + live IST clock', !!m && diff <= 1, `"${where}", Asia/Kolkata now ${now}`);
  check('clock is not announced (aria-live off)', (await p.locator('.cert .istclock').getAttribute('aria-live')) === 'off');
  const hydr = logs.filter((l) => /hydrat|did not match/i.test(l));
  check('no hydration mismatch', hydr.length === 0, hydr[0] ?? '');
  const text = await p.locator('main').innerText();
  check('no "Open to remote roles worldwide"', !/open to remote roles/i.test(text));
  check('no CHECKED UNDER / PASS strip', !/checked under/i.test(text) && (await p.locator('.cert__stamp, .cert__foot').count()) === 0);
  await p.close();
}

// ── Mitooshi ──
{
  const { p } = await page('/work/mitooshi');
  const frames = await p.locator('.proof').count();
  const vids = await p.locator('.proof video source[src*="/work/mitooshi/0"]').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
  check('Mitooshi has 5 deliverables', frames === 5, `${frames} frames`);
  check('04 and 05 are MP4 + WebM loops', ['04.webm', '04.mp4', '05.webm', '05.mp4'].every((f) => vids.some((v) => v.endsWith(f))), vids.join(' '));
  await p.close();
  const leftovers = [];
  const scan = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${f.name}`;
      if (f.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'assets-src', 'lamp-review'].includes(f.name)) scan(path);
      } else if (/\.(ts|tsx|mjs|json|css)$/.test(f.name) && /mitooshi\/(0[67][.-]|04\.webp|05\.mp4.*poster|07)/.test(readFileSync(path, 'utf8'))) leftovers.push(path);
    }
  };
  scan('.');
  const files = ['04.webp', '06.webp', '07.mp4', '07-poster.webp'].filter((f) => existsSync(`public/work/mitooshi/${f}`));
  check('no Mitooshi 04-07 leftovers (code, data, files)', leftovers.length === 0 && files.length === 0, [...leftovers, ...files].join(', '));
}

// ── archive ──
{
  const { p } = await page('/archive');
  const caps = await p.locator('.archive__caption').allInnerTexts();
  const nums = caps.map((c) => +c.match(/^A(\d+)/)[1]);
  check('archive numbered A01..An with no gaps', nums.every((n, i) => n === i + 1), `${nums.length} pieces, last A${nums.at(-1)}`);
  const title = (n) => caps[n - 1]?.replace(/^A\d+\s*/, '').trim();
  const expect = [
    [1, 'GOMH - ADHAYAN - MUSIC COVER ART'],
    [2, '2FAST - BANZ2FADED - MUSIC COVER ART'],
    [3, 'AMNESIA MUSIC COVER ART EXPLORATION FOR SUFR'],
    [5, 'ALONE - 3D EXPLORATION'],
    [6, 'HOGWARTS CLASSROOM - 3D EXPLORATION - MADE IN UNREAL ENGINE'],
    [13, 'MERCEDES-BENZ AMG GTR - 3D EXPLORATION'],
    [21, 'MERCEDES-BENZ AMG GTR - 3D EXPLORATION'],
    [22, 'PORSCHE GT3 RS 3D EXPLORATION'],
    [30, 'A RETRO COMPUTER'],
  ];
  const wrong = expect.filter(([n, t]) => title(n) !== t);
  check('archive titles exactly as given', wrong.length === 0, wrong.map(([n, t]) => `A${n}: "${title(n)}" ≠ "${t}"`).join('; '));
  const clipNos = await p.locator('.archive__item:has(video) .archive__caption').allInnerTexts();
  check('AMG clips right after the last AMG still (A18-A21)', clipNos.map((c) => c.slice(0, 3)).join() === 'A18,A19,A20,A21', clipNos.map((c) => c.slice(0, 3)).join());
  await p.locator('.chip', { hasText: 'Posters' }).click();
  await p.waitForURL(/series=posters/);
  await p.waitForTimeout(300);
  const posters = await p.locator('.archive__item').count();
  check('chips filter, kept in ?series=', posters === 10 && /series=posters/.test(p.url()), `${posters} posters`);
  const chips = await p.locator('.chip').allInnerTexts();
  check('one row of chips: All · Music cover art · 3D explorations · Posters · Other', chips.map((c) => c.replace(/\s*\d+$/, '').trim()).join(' · ') === 'All · Music cover art · 3D explorations · Posters · Other', chips.join(' | '));
  await p.close();
}
// M5 (09): every "Book a viewing" / contact link on the site is the one helper's mailto (lib/site.ts):
// the visitor's own mail app, To work@visheshmahendru.com, the agreed subject and body, CRLF encoded
{
  const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const want = `mailto:work@visheshmahendru.com?subject=${enc("Saw your portfolio, let's connect")}&body=${enc("Hi Vishesh,\r\nI just went through your portfolio at www.visheshmahendru.com and really liked your work. I'd love to connect.")}`;
  const p = await b.newPage({ viewport: { width: 1568, height: 980 }, reducedMotion: 'reduce' });
  for (const route of ['/', '/about', '/archive', '/house-lights', '/work/sonde', '/nope-404']) {
    await p.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    const hrefs = await p.$$eval('a[href^="mailto:"]', (as) => as.map((a) => a.getAttribute('href')));
    const bad = hrefs.filter((h) => h !== want);
    check(`${route}: ${hrefs.length} contact links, all the shared helper's mailto`, hrefs.length > 0 && bad.length === 0, bad[0] ?? '');
  }
  await p.close();
}
await b.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} FAILED` : `PASS, ${results.length} of ${results.length}`);
process.exit(failed ? 1 : 0);
