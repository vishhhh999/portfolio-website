/**
 * Masters pipeline (B4). Replaces the 256-colour images imported from Framer with Vish's
 * full-colour masters.
 *
 *   node tools/import-masters.mjs            download masters-v1, match, encode, report
 *   node tools/import-masters.mjs --dry      match and report only, write nothing to public/
 *   MASTERS_ZIP=path/to.zip node ...         use a local zip instead of the release
 *
 * 1. Fetches the `masters-v1` release asset (gh release download; falls back to the public URL).
 * 2. Matches every master to the image it replaces by perceptual hash: dHash + aHash, 64-bit each,
 *    over the image composited on white. A match needs both distances <= 10. Ties (a second
 *    candidate within 2 of the best) and misses are listed, never guessed. Filenames are ignored,
 *    except one explicit folder: about-portrait/ is the About portrait (a different crop of the
 *    same photo, so hashing cannot match it).
 * 3. Re-encodes matched masters: AVIF (4:4:4, quality raised until PSNR >= 42 dB against the master,
 *    so smooth gradients keep their steps) + a WebP fallback, sRGB, long edge capped at 3000px.
 *    Alpha kept only where the master actually uses it. Masters that are still indexed (PNG colour
 *    type 3) are reported and NOT used: re-encoding a palette image cannot restore its gradients.
 * 4. Writes content/masters.ts (which web paths now have an AVIF) and tools/masters-report.md.
 */
import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = join(ROOT, 'tools/import/masters');
const TAG = 'masters-v1';
const REPO = 'vishhhh999/portfolio-website';
const dry = process.argv.includes('--dry');
mkdirSync(WORK, { recursive: true });

function fetchZip() {
  if (process.env.MASTERS_ZIP) return process.env.MASTERS_ZIP;
  const zip = join(WORK, `${TAG}.zip`);
  if (existsSync(zip)) return zip;
  const gh = spawnSync('gh', ['release', 'download', TAG, '-R', REPO, '-p', '*.zip', '-D', WORK, '--clobber'], { stdio: 'inherit' });
  if (gh.status === 0) {
    const out = execFileSync('sh', ['-c', `ls "${WORK}"/*.zip | head -1`]).toString().trim();
    if (out) return out;
  }
  console.log('gh unavailable or unauthenticated: downloading the public release asset');
  const curl = spawnSync('curl', ['-sSfL', '-o', zip, `https://github.com/${REPO}/releases/download/${TAG}/${TAG}.zip`], { stdio: 'inherit' });
  if (curl.status !== 0) return null;
  return zip;
}

const zip = fetchZip();
const report = join(ROOT, 'tools/masters-report.md');
if (!zip) {
  writeFileSync(report, `# Masters report\n\nThe \`${TAG}\` release asset could not be downloaded. Nothing was changed.\n`);
  console.log('release missing: report written, nothing changed');
  process.exit(0);
}
const dir = join(WORK, 'x');
if (!existsSync(dir)) execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);

const py = String.raw`
import glob, io, json, os, sys
import numpy as np
from PIL import Image

ROOT, DIR, DRY = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
ACCEPT, TIE, MAX_EDGE = 10, 2, 3000

def flat(im):
    im = im.convert('RGBA')
    bg = Image.new('RGB', im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[3])
    return bg

def bits(a): return int(''.join('1' if x else '0' for x in a.flatten()), 2)
def dhash(im):
    g = np.asarray(im.convert('L').resize((9, 8), Image.LANCZOS), dtype=np.int32)
    return bits(g[:, 1:] > g[:, :-1])
def ahash(im):
    g = np.asarray(im.convert('L').resize((8, 8), Image.LANCZOS), dtype=np.float64)
    return bits(g > g.mean())
def ham(a, b): return bin(a ^ b).count('1')

# current web images: proofs, video posters, archive, the About portrait
targets = []
for f in sorted(glob.glob(f'{ROOT}/public/work/*/*.webp') + glob.glob(f'{ROOT}/public/archive/*.webp') + glob.glob(f'{ROOT}/public/about/portrait.webp')):
    if f.endswith('-fluor.webp'): continue
    im = flat(Image.open(f))
    targets.append({'path': os.path.relpath(f, ROOT), 'd': dhash(im), 'a': ahash(im), 'size': os.path.getsize(f), 'dims': im.size})

masters = sorted(glob.glob(f'{DIR}/**/*.png', recursive=True))
rows, used = [], {}
for m in masters:
    rel = os.path.relpath(m, DIR)
    src = Image.open(m)
    indexed = src.mode == 'P'
    im = flat(src)
    d, a = dhash(im), ahash(im)
    if '/about-portrait/' in '/' + rel:
        rows.append({'master': rel, 'status': 'matched', 'target': 'public/about/portrait.webp', 'why': 'explicit folder about-portrait/', 'indexed': indexed, 'dims': src.size})
        continue
    scored = sorted(({'t': t, 'dd': ham(d, t['d']), 'da': ham(a, t['a'])} for t in targets), key=lambda s: (s['dd'] + s['da'], s['dd']))
    ok = [s for s in scored if s['dd'] <= ACCEPT and s['da'] <= ACCEPT]
    row = {'master': rel, 'indexed': indexed, 'dims': src.size}
    if not ok:
        best = scored[0]
        row.update(status='unmatched', why=f"nearest {best['t']['path']} (dHash {best['dd']}, aHash {best['da']})")
    elif len(ok) > 1 and (ok[1]['dd'] + ok[1]['da']) - (ok[0]['dd'] + ok[0]['da']) <= TIE:
        row.update(status='tie', why=' vs '.join(f"{s['t']['path']} ({s['dd']}/{s['da']})" for s in ok[:3]))
    else:
        row.update(status='matched', target=ok[0]['t']['path'], why=f"dHash {ok[0]['dd']}, aHash {ok[0]['da']}")
    rows.append(row)

# one master per target: a second claim on the same image is a conflict, listed, not resolved
for r in rows:
    if r['status'] != 'matched': continue
    if r['target'] in used:
        r['status'] = 'conflict'; r['why'] += f" (also claimed by {used[r['target']]['master']})"
        used[r['target']]['status'] = 'conflict'
    else:
        used[r['target']] = r

from PIL import ImageFilter

def blur(a):
    """Gaussian σ = 2px: removes the masters' fine grain, keeps gradients (where banding lives)."""
    return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float64)

def smooth_mask(blurred):
    """Smooth regions (gentle gradients and flats) of the blurred master: luminance Sobel < 3/255."""
    l = blurred[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    gx = np.zeros_like(l); gy = np.zeros_like(l)
    gx[1:-1, 1:-1] = (l[:-2, 2:] + 2 * l[1:-1, 2:] + l[2:, 2:] - l[:-2, :-2] - 2 * l[1:-1, :-2] - l[2:, :-2]) / 4
    gy[1:-1, 1:-1] = (l[2:, :-2] + 2 * l[2:, 1:-1] + l[2:, 2:] - l[:-2, :-2] - 2 * l[:-2, 1:-1] - l[:-2, 2:]) / 4
    return np.hypot(gx, gy) < 3

def psnr(a, b):
    d = (np.asarray(a, dtype=np.float64)[..., :3] - np.asarray(b, dtype=np.float64)[..., :3]) ** 2
    return 99.0 if d.mean() == 0 else 10 * np.log10(255.0 ** 2 / d.mean())

def encode(r):
    src = Image.open(os.path.join(DIR, r['master'])).convert('RGBA')
    if max(src.size) > MAX_EDGE:
        s = MAX_EDGE / max(src.size)
        src = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    alpha = src.split()[3].getextrema()[0] < 255
    out = src if alpha else src.convert('RGB')
    ref = np.asarray(out).astype(np.float64)
    rb = blur(ref[..., :3])
    mask = smooth_mask(rb)
    # Banding is a low-frequency error: compare the blurred images in smooth regions. The lowest
    # quality whose gradients stay within 3 levels (99.9th percentile) and 8 levels (worst pixel)
    # of the master, with the whole image >= 36 dB. Fine grain is allowed to soften; steps are not.
    q, best = 50, None
    while q <= 92:
        buf = io.BytesIO()
        out.save(buf, 'AVIF', quality=q, subsampling='4:4:4', speed=6)
        back = np.asarray(Image.open(io.BytesIO(buf.getvalue())).convert(out.mode)).astype(np.float64)
        e = np.abs(blur(back[..., :3]) - rb)[mask] if mask.any() else np.zeros(1)
        p999, worst, pa = float(np.percentile(e, 99.9)), float(e.max()), psnr(ref, back)
        best = (q, buf.getvalue(), p999, pa, float(mask.mean()), worst)
        if p999 <= 3.0 and worst <= 8.0 and pa >= 36.0: break
        q += 6
    wbuf = io.BytesIO()
    out.save(wbuf, 'WEBP', quality=86, method=6, alpha_quality=100)
    return best, wbuf.getvalue(), out.size, alpha

todo = []
for r in rows:
    if r['status'] != 'matched': continue
    if r['indexed']:
        r['status'] = 'still-indexed'
        continue
    todo.append(r)

from concurrent.futures import ProcessPoolExecutor
avif = []
with ProcessPoolExecutor(max_workers=os.cpu_count() or 2) as pool:
    for r, (best, webp, dims, alpha) in zip(todo, pool.map(encode, todo)):
        base = os.path.splitext(r['target'])[0]
        tgt = next((t for t in targets if t['path'] == r['target']), None)
        r.update(before=tgt['size'] if tgt else 0, avif=len(best[1]), webp=len(webp), q=best[0], p999=round(best[2], 1), worst=round(best[5], 1), psnr_all=round(best[3], 1), smooth=round(best[4] * 100), out_dims=dims, alpha=alpha)
        if not DRY:
            os.makedirs(os.path.join(ROOT, os.path.dirname(base)), exist_ok=True)
            open(os.path.join(ROOT, base + '.avif'), 'wb').write(best[1])
            open(os.path.join(ROOT, base + '.webp'), 'wb').write(webp)
        avif.append(base[len('public'):] + '.webp')
        print(f"{r['status']:13} {r['master']} -> {r['target']}  q{best[0]} gradient p99.9 {best[2]:.1f} worst {best[5]:.0f} levels, all {best[3]:.1f}dB ({best[4] * 100:.0f}% smooth)", file=sys.stderr, flush=True)

matched_targets = {r.get('target') for r in rows if r.get('target')}
print(json.dumps({'rows': rows, 'avif': sorted(avif), 'untouched': [t['path'] for t in targets if t['path'] not in matched_targets]}))
`;

const res = spawnSync('python3', ['-c', py, ROOT, dir, dry ? '1' : '0'], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'inherit'] });
if (res.status !== 0) process.exit(1);
const lines = res.stdout.trim().split('\n');
const data = JSON.parse(lines.pop());
lines.forEach((l) => console.log(l));

if (!dry) {
  writeFileSync(
    join(ROOT, 'content/masters.ts'),
    `/** Web paths re-encoded from full-colour masters (tools/import-masters.mjs): each has an .avif beside the .webp. */\nexport const AVIF_SOURCES = new Set<string>(${JSON.stringify(data.avif, null, 2)});\n\n/** The .avif twin of a web path, when a master exists for it. */\nexport const avifFor = (src: string) => (AVIF_SOURCES.has(src) ? src.replace(/\\.webp$/, '.avif') : null);\n`,
  );
}

const kb = (n) => `${Math.round(n / 1024)} KB`;
const by = (s) => data.rows.filter((r) => r.status === s);
const m = by('matched');
const sum = (k) => m.reduce((a, r) => a + (r[k] || 0), 0);
let md = `# Masters report (${TAG})\n\n`;
md += `Source: \`${TAG}.zip\` from the GitHub release, ${data.rows.length} PNG masters.\n\n`;
md += `| | count |\n|---|---|\n| matched and re-encoded | ${m.length} |\n| still indexed (colour type 3), not used | ${by('still-indexed').length} |\n| unmatched | ${by('unmatched').length} |\n| ties | ${by('tie').length} |\n| conflicts | ${by('conflict').length} |\n| current images with no master | ${data.untouched.length} |\n\n`;
if (m.length) md += `Payload of the matched images: ${kb(sum('before'))} before (WebP from 256-colour sources) → ${kb(sum('avif'))} AVIF (served first) / ${kb(sum('webp'))} WebP fallback.\n\n`;
md += `## Matched\n\nAVIF quality is the lowest at which smooth regions (gentle gradients and flats, where banding would show) stay within 3 levels (99.9th percentile) and 8 levels (worst pixel) of the master after a 2px blur (which removes the masters' fine grain but keeps every step), with the whole image at 36 dB PSNR or better. WebP fallback at quality 86.\n\n| master | replaces | match | AVIF q | gradient error p99.9 / worst (levels) | all PSNR | before | AVIF | WebP |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const r of m) md += `| ${r.master} | ${r.target} | ${r.why} | ${r.q} | ${r.p999} / ${r.worst} | ${r.psnr_all} dB | ${kb(r.before)} | ${kb(r.avif)} | ${kb(r.webp)} |\n`;
for (const [title, s] of [['Still indexed (not used)', 'still-indexed'], ['Unmatched', 'unmatched'], ['Ties', 'tie'], ['Conflicts', 'conflict']]) {
  const list = by(s);
  md += `\n## ${title}\n\n` + (list.length ? list.map((r) => `- ${r.master}${r.target ? ` → ${r.target}` : ''}: ${r.why}`).join('\n') + '\n' : 'None.\n');
}
md += `\n## Current images with no master\n\n` + (data.untouched.length ? data.untouched.map((p) => `- ${p}`).join('\n') + '\n' : 'None.\n');
if (!dry) writeFileSync(report, md);
console.log(dry ? md : `report: tools/masters-report.md`);
