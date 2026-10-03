/**
 * Imports copy + deliverables from the live Framer site (before it's shut down).
 *
 *   node tools/import-framer.mjs            # fetch, download, encode, write overlay
 *   node tools/import-framer.mjs --dry      # fetch + parse only, no downloads
 *   node tools/import-framer.mjs --selftest # parse a fixture shaped like the live markup
 *
 * Needs network access to www.visheshmahendru.com and framerusercontent.com (curl, so
 * HTTPS_PROXY is honoured) and ffmpeg/ffprobe + python3 Pillow for encoding.
 *
 * Live page anatomy (verified against the real markup, Oct 2026):
 *   nav (repeated once per breakpoint) · "07" "/ 09" counter · <h1> title ·
 *   year · role · client type · scope tags · optional "LIVE SITE" link ·
 *   intro paragraph · (SECTION HEADING · paragraph)* · media in page order ·
 *   "NEXT PROJECT" cards (two, each with an h1 + thumbnail) · footer (repeated).
 * Everything from the first "NEXT PROJECT" on is chrome, not this project.
 *
 * For each project it:
 *   1. saves the parsed page to tools/import/raw/<slug>.json
 *   2. downloads every image/video at source resolution to tools/import/source/<slug>/
 *      (gitignored: the untouched backup of the Framer site)
 *   3. encodes web copies to public/work/<slug>/NN.webp, or NN.mp4 + NN-poster.webp,
 *      recording intrinsic width/height
 *   4. writes content/work/imported.ts: an overlay merged into the typed content
 *      (copy imported as-is, never rewritten; missing fields stay TBC)
 *   5. prints the found / missing table and flags alt text reused across projects
 * /archive and /about are dumped to tools/import/raw/ (about copy also to
 * content/about.raw.md) for Phase 5.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'fs';
import path from 'path';

const SITE = 'https://www.visheshmahendru.com';
const ROOT = new URL('..', import.meta.url).pathname;
const DRY = process.argv.includes('--dry');
/** live slug → content slug */
const PROJECTS = {
  'too-yumm': 'too-yumm',
  mitooshi: 'mitooshi',
  sook: 'sook',
  'house-of-hex': 'house-of-hex',
  sonde: 'sonde',
  indothai: 'indo-thai',
  'bengal-t20-league': 'bengal-t20',
  shunya: 'shunya',
  'jsw-sports': 'jsw-sports',
};

const curl = (url, out) =>
  execFileSync('curl', ['-sSfL', '--retry', '3', '-A', 'Mozilla/5.0 (portfolio import)', ...(out ? ['-o', out] : []), url], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString();

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .trim();

/** Framer resize params (?scale-down-to=, ?width=, ?lossless=) off: the source file. */
const sourceUrl = (u) => u.split('?')[0];

/** Nav, footer, counters and separators: site chrome, never project copy. */
const CHROME = /^(VISHESH MAHENDRU|ABOUT|CONTACT|\[[A-Z ]+\]|©\s*\d{4}|\d{2}|\/\s*\d{2}|·|NEXT PROJECT)$/;

/** Text blocks and media, interleaved in document order. */
function tokens(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const out = [];
  const re = /<(h[1-6]|p)\b[^>]*class="[^"]*framer-text[^"]*"[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>|<video\b[^>]*>/gi;
  let m;
  while ((m = re.exec(body))) {
    if (m[1]) {
      const text = decode(m[2]);
      if (!text) continue;
      // the enclosing link, if any (e.g. "LIVE SITE")
      const before = body.slice(Math.max(0, m.index - 4000), m.index);
      const open = before.lastIndexOf('<a ');
      const href = open > before.lastIndexOf('</a>') ? (before.slice(open).match(/href="([^"]+)"/) || [])[1] : undefined;
      out.push({ kind: 'text', tag: m[1].toLowerCase(), text, href });
    } else {
      const tag = m[0];
      const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
      if (!src || !src.includes('framerusercontent.com')) continue;
      const num = (a) => Number((tag.match(new RegExp(`\\s${a}="(\\d+)"`)) || [])[1]) || undefined;
      out.push({
        kind: 'media',
        type: tag.startsWith('<video') ? 'video' : 'image',
        src: sourceUrl(src.replace(/&amp;/g, '&')),
        alt: decode((tag.match(/\salt="([^"]*)"/) || [])[1] || ''),
        width: num('width'),
        height: num('height'),
      });
    }
  }
  return out;
}

const dedupeMedia = (list) => {
  const seen = new Set();
  return list.filter((m) => (seen.has(m.src) ? false : (seen.add(m.src), true)));
};

const isHeading = (t) => t.length <= 48 && t === t.toUpperCase() && /[A-Z]/.test(t);

/** A project page: title, meta line, intro, sections, deliverables. Only the project's own region. */
function parseProject(html) {
  const all = tokens(html);
  const start = all.findIndex((t) => t.kind === 'text' && t.tag === 'h1');
  let end = all.findIndex((t, i) => i > start && t.kind === 'text' && t.text === 'NEXT PROJECT');
  if (end < 0) end = all.length;
  const region = all.slice(start, end);
  const title = region[0]?.text || '';
  const texts = region.filter((t) => t.kind === 'text').slice(1).filter((t) => !CHROME.test(t.text));

  // meta line: everything before the first real paragraph
  const firstPara = texts.findIndex((t) => t.text.length > 80);
  const meta = texts.slice(0, firstPara < 0 ? texts.length : firstPara);
  const prose = firstPara < 0 ? [] : texts.slice(firstPara);
  const out = { title, tags: [] };
  for (const t of meta) {
    if (t.text === 'LIVE SITE' && t.href) out.live = t.href;
    else if (!out.year && /^(19|20)\d\d$/.test(t.text)) out.year = Number(t.text);
    else if (!out.role && out.year && !isHeading(t.text)) out.role = t.text;
    else if (!out.clientType && out.role && !isHeading(t.text)) out.clientType = t.text;
    else out.tags.push(t.text);
  }
  out.description = [];
  out.sections = [];
  for (const t of prose) {
    if (isHeading(t.text)) out.sections.push({ heading: t.text, body: [] });
    else if (out.sections.length) out.sections.at(-1).body.push(t.text);
    else out.description.push(t.text);
  }
  out.media = dedupeMedia(region.filter((t) => t.kind === 'media')).map(({ kind, ...m }) => m);
  return out;
}

/** /about, /archive: every non-chrome text block and every media item, in order. */
function parsePage(html) {
  const all = tokens(html);
  const texts = all.filter((t) => t.kind === 'text' && !CHROME.test(t.text)).map(({ tag, text, href }) => ({ tag, text, ...(href ? { href } : {}) }));
  const seenText = new Set();
  return {
    texts: texts.filter((t) => (seenText.has(t.text) ? false : (seenText.add(t.text), true))),
    media: dedupeMedia(all.filter((t) => t.kind === 'media')).map(({ kind, ...m }) => m),
  };
}

/**
 * The /archive canvas is a code component: its <img> tags have no src until JS runs. The items
 * (alt, source URL, pixel size) live in the page's own JS module as \`images:[{alt:…, image:{src…}}]\`.
 */
function archiveFromModules(html) {
  const mods = [...new Set(html.match(/https:\/\/framerusercontent\.com\/sites\/[^"']+\.mjs/g) || [])];
  for (const u of mods) {
    const js = curl(u);
    const at = js.indexOf('images:[{alt:');
    if (at < 0) continue;
    return js
      .slice(at)
      .split('{alt:`')
      .slice(1)
      .map((it) => ({
        type: 'image',
        alt: it.slice(0, it.indexOf('`')),
        src: (it.match(/src:`(https:\/\/framerusercontent\.com\/[^`?]+)/) || [])[1],
        width: Number((it.match(/pixelWidth:([\de.]+)/) || [])[1]) || undefined,
        height: Number((it.match(/pixelHeight:([\de.]+)/) || [])[1]) || undefined,
      }))
      .filter((m) => m.src);
  }
  return [];
}

const ext = (u, type) => path.extname(u).toLowerCase() || (type === 'video' ? '.mp4' : '.jpg');
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).toString();
const fresh = (out, src) => existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs;

const ENCODE_IMAGE = `
import sys
from PIL import Image
src, out, write, edge = sys.argv[1], sys.argv[2], sys.argv[3] == '1', int(sys.argv[4])
if write:
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if max(im.size) > edge:
        im.thumbnail((edge, edge), Image.LANCZOS)
    im.save(out, 'WEBP', quality=82, method=6)
print('%dx%d' % Image.open(out).size)
`;

/** Web copy of one source file. Images → WebP (≤2400px long edge); video → H.264 MP4 (≤1920w, no audio) + WebP poster. */
function encode(src, outBase, type, edge = 2400) {
  if (type === 'image') {
    const out = `${outBase}.webp`;
    const [width, height] = run('python3', ['-c', ENCODE_IMAGE, src, out, fresh(out, src) ? '0' : '1', String(edge)]).trim().split('x').map(Number);
    return { file: out, width, height };
  }
  const out = `${outBase}.mp4`;
  const poster = `${outBase}-poster.webp`;
  if (!fresh(out, src))
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-an', '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  if (!fresh(poster, out)) {
    const png = `${outBase}-poster.png`;
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-frames:v', '1', png]);
    run('python3', ['-c', ENCODE_IMAGE, png, poster, '1', '2400']);
    run('rm', [png]);
  }
  const [width, height] = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', out]).trim().split('x').map(Number);
  return { file: out, poster, width, height };
}

export { tokens, parseProject, parsePage };
const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;

if (isMain && process.argv.includes('--selftest')) {
  const nav = '<p class="framer-text">VISHESH MAHENDRU</p><p class="framer-text">ABOUT</p><p class="framer-text">[ARCHIVE]</p>';
  const html =
    nav + nav +
    '<p class="framer-text">07</p><p class="framer-text">/ 09</p><h1 class="framer-text">TOO YUMM</h1><p class="framer-text">2024</p><p class="framer-text">·</p>' +
    '<p class="framer-text">Packaging Designer, 3D Visualization</p><p class="framer-text">·</p><p class="framer-text">Studio</p>' +
    '<p class="framer-text">PACKAGING DESIGN</p><p class="framer-text">3D RENDERING</p><a href="https://example.com/"><p class="framer-text">LIVE SITE</p></a>' +
    '<p class="framer-text">Packaging and 3D visualization for a new flavored nuts line, extending an established mass-market brand.</p>' +
    '<p class="framer-text">ONE BRAND, MANY SHELVES</p><p class="framer-text">Flavored nuts is a crowded category, and most of that clutter comes from packaging that is fighting for attention.</p>' +
    '<img width="2385" height="1500" src="https://framerusercontent.com/images/a.png?width=2385&amp;height=1500" alt="Two pouches">' +
    '<img width="2385" height="1500" src="https://framerusercontent.com/images/a.png?scale-down-to=512" alt="dup">' +
    '<video src="https://framerusercontent.com/assets/v.mp4" loop muted>' +
    '<p class="framer-text">NEXT PROJECT</p><h1 class="framer-text">SOOK</h1><img src="https://framerusercontent.com/images/next.png" alt="Other project">' +
    '<p class="framer-text">© 2026</p>';
  const p = parseProject(html);
  const ok =
    p.title === 'TOO YUMM' && p.year === 2024 && p.role === 'Packaging Designer, 3D Visualization' && p.clientType === 'Studio' &&
    p.tags.join('|') === 'PACKAGING DESIGN|3D RENDERING' && p.live === 'https://example.com/' && p.description.length === 1 &&
    p.sections.length === 1 && p.sections[0].body.length === 1 && p.media.length === 2 && p.media[0].width === 2385 && p.media[1].type === 'video';
  console.log(JSON.stringify(p, null, 1));
  console.log(ok ? 'selftest ok' : 'selftest FAILED');
  process.exit(ok ? 0 : 1);
}

if (isMain && !process.argv.includes('--selftest')) {
  const overlay = {};
  const table = [];
  const altUse = new Map();
  mkdirSync(path.join(ROOT, 'tools/import/raw'), { recursive: true });

  for (const [live, slug] of Object.entries(PROJECTS)) {
    const url = `${SITE}/projects/${live}`;
    let html;
    try {
      html = curl(url);
    } catch (e) {
      console.error(`✗ ${url}: ${e.message.split('\n')[0]}`);
      table.push({ slug, error: 'fetch failed' });
      continue;
    }
    const page = parseProject(html);
    const srcDir = path.join(ROOT, 'tools/import/source', slug);
    const webDir = path.join(ROOT, 'public/work', slug);
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(webDir, { recursive: true });
    const deliverables = page.media.map((m, i) => {
      const n = String(i + 1).padStart(2, '0');
      const d = { type: m.type, src: '', alt: m.alt || 'TBC', source: m.src, width: m.width, height: m.height };
      if (m.alt) altUse.set(m.alt, [...(altUse.get(m.alt) || []), `${slug}/${n}`]);
      if (DRY) return d;
      const source = path.join(srcDir, `${n}${ext(m.src, m.type)}`);
      if (!existsSync(source)) curl(m.src, source);
      const e = encode(source, path.join(webDir, n), m.type);
      d.src = `/work/${slug}/${path.basename(e.file)}`;
      if (e.poster) d.poster = `/work/${slug}/${path.basename(e.poster)}`;
      d.width = e.width;
      d.height = e.height;
      return d;
    });
    const { media, ...copy } = page;
    writeFileSync(path.join(ROOT, 'tools/import/raw', `${slug}.json`), JSON.stringify({ url, ...copy, deliverables }, null, 2));
    overlay[slug] = {
      title: page.title,
      ...(page.year ? { year: page.year } : {}),
      ...(page.role ? { role: page.role } : {}),
      ...(page.clientType ? { clientType: page.clientType } : {}),
      ...(page.tags.length ? { scope: page.tags.join(', ') } : {}),
      ...(page.live ? { live: page.live } : {}),
      ...(page.description.length ? { description: page.description } : {}),
      ...(page.sections.length ? { sections: page.sections } : {}),
      deliverables,
    };
    const noAlt = deliverables.filter((d) => d.alt === 'TBC').length;
    const missing = [
      !page.year && 'year',
      !page.role && 'role',
      !page.tags.length && 'scope',
      !page.clientType && 'client type',
      'client name',
      'credits',
      'Behance URL',
      noAlt && `alt × ${noAlt}`,
    ].filter(Boolean);
    table.push({
      slug,
      year: page.year || '—',
      role: page.role || '—',
      clientType: page.clientType || '—',
      scope: page.tags.join(', ') || '—',
      copy: `${page.description.length}+${page.sections.length}s`,
      media: `${deliverables.filter((d) => d.type === 'image').length}i/${deliverables.filter((d) => d.type === 'video').length}v`,
      fit: deliverables.length === 6 ? '6 ✓' : deliverables.length > 6 ? `${deliverables.length}: pick 6` : `${deliverables.length}: ${6 - deliverables.length} short`,
      missing: missing.join(', '),
    });
  }

  for (const name of ['archive', 'about']) {
    try {
      const html = curl(`${SITE}/${name}`);
      const parsed = parsePage(html);
      if (name === 'archive' && !parsed.media.length) parsed.media = archiveFromModules(html);
      if (name === 'about') writeFileSync(path.join(ROOT, 'content/about.raw.md'), parsed.texts.map((t) => (t.tag.startsWith('h') ? `## ${t.text}` : t.text)).join('\n\n') + '\n');
      if (name === 'archive' && !DRY) {
        const srcDir = path.join(ROOT, 'tools/import/source/archive');
        const webDir = path.join(ROOT, 'public/archive');
        mkdirSync(srcDir, { recursive: true });
        mkdirSync(webDir, { recursive: true });
        parsed.media = parsed.media.map((m, i) => {
          const n = String(i + 1).padStart(2, '0');
          const source = path.join(srcDir, `${n}${ext(m.src, m.type)}`);
          if (!existsSync(source)) curl(m.src, source);
          const e = encode(source, path.join(webDir, n), m.type, 1600); // canvas tiles: 1600px is plenty
          return { ...m, source: m.src, src: `/archive/${path.basename(e.file)}`, ...(e.poster ? { poster: `/archive/${path.basename(e.poster)}` } : {}), width: e.width, height: e.height, alt: m.alt || 'TBC' };
        });
        overlay.__archive = parsed.media;
      }
      writeFileSync(path.join(ROOT, 'tools/import/raw', `${name}.json`), JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error(`✗ /${name}: ${e.message.split('\n')[0]}`);
    }
  }

  if (!DRY && Object.keys(overlay).length) {
    writeFileSync(
      path.join(ROOT, 'content/work/imported.ts'),
      `// Generated by tools/import-framer.mjs from the live Framer site. Copy is imported as-is.\n` +
        `// Re-run the importer to refresh; edit the per-project files for anything hand-written.\n` +
        `export const imported: Record<string, unknown> = ${JSON.stringify(overlay, null, 2)};\n`,
    );
  }

  console.table(table);
  const reused = [...altUse.entries()].filter(([, files]) => new Set(files.map((f) => f.split('/')[0])).size > 1);
  if (reused.length) {
    console.log('\nAlt text reused across projects (fix each to describe its own image):');
    for (const [alt, files] of reused) console.log(`  "${alt}" → ${files.join(', ')}`);
  }
}
