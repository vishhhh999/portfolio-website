/**
 * Imports copy + deliverables from the live Framer site (before it's shut down).
 *
 *   node tools/import-framer.mjs            # fetch, download, write overlay
 *   node tools/import-framer.mjs --dry      # fetch + parse only, no downloads
 *
 * Needs network access to www.visheshmahendru.com and framerusercontent.com
 * (uses curl, so HTTPS_PROXY is honoured). For each project it:
 *   1. saves the parsed page to tools/import/raw/<slug>.json (title, every text
 *      block in page order, every image/video with its alt text, in order)
 *   2. downloads every image/video at source resolution (Framer resize params
 *      stripped) to public/work/<slug>/01.ext, 02.ext … in page order
 *   3. writes content/work/imported.ts: an overlay merged into the typed content
 *      (copy imported as-is, never rewritten; missing fields stay TBC)
 *   4. prints the found / missing table and flags alt text reused across projects
 * /archive and /about are dumped to tools/import/raw/ (about copy also to
 * content/about.raw.md) for Phase 5.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
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

function parse(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const texts = [];
  const textRe = /<(h1|h2|h3|h4|h5|h6|p)\b[^>]*class="[^"]*framer-text[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = textRe.exec(body))) {
    const t = decode(m[2]);
    if (t) texts.push({ tag: m[1].toLowerCase(), text: t });
  }
  const media = [];
  const seen = new Set();
  const mediaRe = /<img\b[^>]*>|<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/>|url\(&quot;(https:\/\/framerusercontent\.com\/[^&]+)&quot;\)/gi;
  while ((m = mediaRe.exec(body))) {
    const tag = m[0];
    let src = m[1] || (tag.match(/\ssrc="([^"]+)"/) || [])[1] || (tag.match(/<source[^>]*src="([^"]+)"/) || [])[1];
    if (!src || !src.includes('framerusercontent.com')) continue;
    const key = sourceUrl(src);
    if (seen.has(key)) continue;
    seen.add(key);
    const alt = decode((tag.match(/\salt="([^"]*)"/) || [])[1] || '');
    media.push({ type: tag.startsWith('<video') || /\.(mp4|webm|mov)$/i.test(key) ? 'video' : 'image', src: key, alt });
  }
  const title = (texts.find((t) => t.tag === 'h1') || texts[0] || {}).text || '';
  return { title, texts, media };
}

/** Best-effort field mapping from labelled text blocks ("Year" → next block, "Role: …", etc.). Copy is never rewritten. */
function fields(texts) {
  const out = {};
  const labels = { year: /^year$/i, role: /^role$/i, scope: /^(scope|services|deliverables)$/i, client: /^client$/i, clientType: /^(client type|industry|sector)$/i, credits: /^(credits?|team)$/i };
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i].text;
    for (const [k, re] of Object.entries(labels)) {
      const inline = t.match(new RegExp(`^${re.source.slice(1, -1)}\\s*[:—-]\\s*(.+)$`, 'i'));
      if (inline) out[k] = inline[1].trim();
      else if (re.test(t) && texts[i + 1]) out[k] = texts[i + 1].text;
    }
  }
  if (out.year) out.year = Number((String(out.year).match(/(19|20)\d\d/) || [])[0]) || out.year;
  const paragraphs = texts.filter((t) => t.tag === 'p' && t.text.length > 80).map((t) => t.text);
  if (paragraphs.length) out.description = paragraphs;
  return out;
}

const ext = (u, type) => (path.extname(u).toLowerCase() || (type === 'video' ? '.mp4' : '.jpg'));

export { parse, fields };
if (process.argv.includes('--selftest')) {
  const html = `<h1 class="framer-text">Too Yumm</h1><p class="framer-text">Packaging</p><p class="framer-text">Year</p><p class="framer-text">2024</p><p class="framer-text">Role: Brand &amp; packaging designer</p><p class="framer-text">A long description paragraph that is definitely more than eighty characters long, describing the work as written.</p><img src="https://framerusercontent.com/images/abc.jpg?scale-down-to=1024" alt="Pouch front" srcset="x"><img src="https://framerusercontent.com/images/abc.jpg?scale-down-to=512" alt="dup"><video src="https://framerusercontent.com/assets/v1.mp4" loop></video><div style="background-image:url(&quot;https://framerusercontent.com/images/bg.png?width=200&quot;)"></div>`;
  const page = parse(html);
  console.log(JSON.stringify({ title: page.title, media: page.media, fields: fields(page.texts) }, null, 1));
  process.exit(0);
}

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
  const page = parse(html);
  const f = fields(page.texts);
  const dir = path.join(ROOT, 'public/work', slug);
  mkdirSync(dir, { recursive: true });
  const deliverables = page.media.map((m, i) => {
    const file = `${String(i + 1).padStart(2, '0')}${ext(m.src, m.type)}`;
    if (!DRY && !existsSync(path.join(dir, file))) curl(m.src, path.join(dir, file));
    if (m.alt) altUse.set(m.alt, [...(altUse.get(m.alt) || []), `${slug}/${file}`]);
    return { type: m.type, src: `/work/${slug}/${file}`, alt: m.alt || 'TBC', source: m.src };
  });
  writeFileSync(path.join(ROOT, 'tools/import/raw', `${slug}.json`), JSON.stringify({ url, ...page, fields: f, deliverables }, null, 2));
  overlay[slug] = { title: page.title || undefined, ...f, deliverables };
  table.push({
    slug,
    found: ['title', ...Object.keys(f)].filter((k) => (k === 'title' ? page.title : f[k])).join(', '),
    missing: ['year', 'role', 'scope', 'client', 'clientType'].filter((k) => !f[k]).join(', ') || '—',
    deliverables: deliverables.length,
    note: deliverables.length === 6 ? '' : deliverables.length > 6 ? `${deliverables.length - 6} extra: pick 6` : `${6 - deliverables.length} short`,
  });
}

for (const page of ['archive', 'about']) {
  try {
    const parsed = parse(curl(`${SITE}/${page}`));
    writeFileSync(path.join(ROOT, 'tools/import/raw', `${page}.json`), JSON.stringify(parsed, null, 2));
    if (page === 'about') writeFileSync(path.join(ROOT, 'content/about.raw.md'), parsed.texts.map((t) => (t.tag.startsWith('h') ? `## ${t.text}` : t.text)).join('\n\n') + '\n');
    if (page === 'archive' && !DRY) {
      const dir = path.join(ROOT, 'public/archive');
      mkdirSync(dir, { recursive: true });
      overlay.__archive = parsed.media.map((m, i) => {
        const file = `${String(i + 1).padStart(2, '0')}${ext(m.src, m.type)}`;
        if (!existsSync(path.join(dir, file))) curl(m.src, path.join(dir, file));
        return { type: m.type, src: `/archive/${file}`, alt: m.alt || 'TBC', source: m.src };
      });
    }
  } catch (e) {
    console.error(`✗ /${page}: ${e.message.split('\n')[0]}`);
  }
}

if (!DRY && Object.keys(overlay).length) {
  writeFileSync(
    path.join(ROOT, 'content/work/imported.ts'),
    `// Generated by tools/import-framer.mjs from the live Framer site. Copy is imported as-is.\n` +
      `// Re-run the importer to refresh; edit the per-project files for anything hand-written.\n` +
      `export const imported: Record<string, Record<string, unknown>> = ${JSON.stringify(overlay, null, 2)};\n`,
  );
}

console.table(table);
const reused = [...altUse.entries()].filter(([, files]) => new Set(files.map((f) => f.split('/')[0])).size > 1);
if (reused.length) {
  console.log('\nAlt text reused across projects (fix each to describe its own image):');
  for (const [alt, files] of reused) console.log(`  "${alt}" → ${files.join(', ')}`);
}
