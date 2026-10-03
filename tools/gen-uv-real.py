"""
UV masks for real deliverables (Too Yumm 01/02), derived from the photographs themselves:

  NN-fluor.webp  fluorescence colour per pixel. Only white ink (optical brightener: the wordmark,
                 icons, nutrition panel) glows, bluish and subtle. The cream sweep and the
                 printed colours stay dark: never a wash.
  NN-uvink.webp  a proofer's marks in technical pen (Geist Mono): dimension lines over the
                 pack group, a shelf line, a centre cross and short callouts to the white ink.

  python3 tools/gen-uv-real.py        (after tools/import-framer.mjs)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
GMONO = os.path.join(ROOT, 'node_modules/geist/dist/fonts/geist-mono/GeistMono-Medium.ttf')
JOBS = [('too-yumm', 1, '2 × 140 MM', 'H 220 MM'), ('too-yumm', 2, '3 × 140 MM', 'H 220 MM')]


def masks(rgb):
    a = rgb.astype(np.float32) / 255
    # background = the sweep: close to the median of the border pixels
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    product = dist > 0.2
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    chroma = a.max(-1) - a.min(-1)
    white_ink = (dist > 0.1) & (lum > 0.84) & (chroma < 0.07)
    return product, white_ink


def bbox(m):
    # robust extent: rows/columns where the product fills a real share, so vignetting and stray pixels don't count
    cols = np.nonzero(m.mean(0) > 0.12)[0]
    rows = np.nonzero(m.mean(1) > 0.12)[0]
    return cols.min(), rows.min(), cols.max(), rows.max()


def dim_h(d, x0, x1, y, label, f, w):
    d.line([x0, y, x1, y], fill=255, width=w)
    for x in (x0, x1):
        d.line([x, y - 12, x, y + 12], fill=255, width=w)
    tw = d.textlength(label, font=f)
    d.rectangle([(x0 + x1) / 2 - tw / 2 - 10, y - 18, (x0 + x1) / 2 + tw / 2 + 10, y + 18], fill=0)
    d.text(((x0 + x1) / 2 - tw / 2, y - 14), label, font=f, fill=255)


def dim_v(d, x, y0, y1, label, f, w):
    d.line([x, y0, x, y1], fill=255, width=w)
    for y in (y0, y1):
        d.line([x - 12, y, x + 12, y], fill=255, width=w)
    tw = d.textlength(label, font=f)
    cy = (y0 + y1) / 2
    d.rectangle([x + 8, cy - 18, x + tw + 30, cy + 18], fill=0)
    d.text((x + 20, cy - 14), label, font=f, fill=255)


def callout(d, px, py, tx, ty, label, f, w, left):
    d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=255)
    d.line([px, py, tx, ty], fill=255, width=w)
    tw = d.textlength(label, font=f)
    end = tx - tw - 24 if left else tx + tw + 24
    d.line([tx, ty, end, ty], fill=255, width=w)
    d.text((min(tx, end) + 12, ty - 34), label, font=f, fill=255)


for slug, i, wlabel, hlabel in JOBS:
    base = os.path.join(ROOT, 'public/work', slug)
    rgb = np.array(Image.open(os.path.join(base, f'{i:02d}.webp')).convert('RGB'))
    H, W = rgb.shape[:2]
    product, white = masks(rgb)
    x0, y0, x1, y1 = bbox(product)
    pad = int(0.01 * W)
    keep = np.zeros_like(white)
    keep[max(0, y0 - pad): y1 + pad, max(0, x0 - pad): x1 + pad] = True
    white &= keep  # specks in the bright sweep are not ink

    # fluorescence: white ink only, bluish, soft-edged, never above ~60% of full scale
    m = Image.fromarray((white * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    k = np.asarray(m, np.float32)[..., None] / 255
    glow = (k * np.array([140, 150, 200], np.float32)).astype(np.uint8)
    Image.fromarray(glow).save(os.path.join(base, f'{i:02d}-fluor.webp'), 'WEBP', quality=88)

    # proofer's marks
    ink = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(ink)
    s = W / 1600
    f = ImageFont.truetype(GMONO, int(26 * s))
    lw = max(2, int(2 * s))
    dim_h(d, x0, x1, max(int(30 * s), y0 - int(44 * s)), wlabel, f, lw)
    dim_v(d, min(W - int(200 * s), x1 + int(40 * s)), y0, y1, hlabel, f, lw)
    sy = min(y1 + int(14 * s), H - int(70 * s))
    d.line([x0 - int(60 * s), sy, x1 + int(60 * s), sy], fill=255, width=lw)
    d.text((x1 - int(150 * s), sy + int(10 * s)), 'SHELF LINE', font=f, fill=255)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    c = int(16 * s)
    d.line([cx - c, cy, cx + c, cy], fill=255, width=lw)
    d.line([cx, cy - c, cx, cy + c], fill=255, width=lw)
    # callout to the densest white-ink patch in the upper half (the wordmark)
    ys, xs = np.nonzero(white[: H // 2])
    if len(xs):
        hist, xe, ye = np.histogram2d(xs, ys, bins=(12, 6))
        bx, by = np.unravel_index(hist.argmax(), hist.shape)
        px, py = int((xe[bx] + xe[bx + 1]) / 2), int((ye[by] + ye[by + 1]) / 2)
        # label out in the sweep, beside the pack group, so it never sits on the artwork
        callout(d, px, py, x0 - int(40 * s), py, 'WHITE INK · OBA', f, lw, True)
    ink.save(os.path.join(base, f'{i:02d}-uvink.webp'), 'WEBP', quality=88)
    print(slug, i, 'white ink %.1f%%' % (white.mean() * 100))
