"""
Neutral placeholder deliverables (until the Framer import can run):
public/work/<slug>/01..06.webp — a seamless paper sweep with soft studio light,
a plain grey product block and a mono caption that says it is a placeholder.
Also UV test masks for Too Yumm 01/02 (fluorMask + uvInk), proving the plane UV slots.
Real files from tools/import-framer.mjs overwrite these (same paths).
"""
import os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'work')
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
HAND = '/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf'
SLUGS = ['too-yumm', 'jsw-sports', 'mitooshi', 'sonde', 'house-of-hex', 'bengal-t20', 'sook', 'shunya', 'indo-thai']
W, H = 1600, 1200

def sweep(seed):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W]
    # paper sweep: brighter top-left key, gentle falloff, horizon curve
    key = 0.80 + 0.12 * np.exp(-(((x - W * 0.3) / (W * 0.7)) ** 2 + ((y - H * 0.15) / (H * 0.8)) ** 2))
    curve = np.clip((y - H * 0.62) / (H * 0.3), 0, 1)
    v = key - 0.06 * curve
    v = v + rng.normal(0, 0.008, (H, W))
    tone = np.array([0.94, 0.935, 0.92])
    img = np.clip(v[..., None] * tone, 0, 1)
    return img

def block(img, seed):
    rnd = random.Random(seed)
    im = Image.fromarray((img * 255).astype(np.uint8))
    d = ImageDraw.Draw(im, 'RGBA')
    bw, bh = rnd.randint(320, 560), rnd.randint(380, 640)
    cx = W // 2 + rnd.randint(-160, 160)
    base = int(H * 0.74)
    # contact shadow
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).ellipse([cx - bw * 0.62, base - 26, cx + bw * 0.62, base + 34], fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(28))
    im = Image.composite(Image.new('RGB', (W, H), (60, 60, 58)), im, sh.point(lambda p: p * 0.55))
    d = ImageDraw.Draw(im, 'RGBA')
    g = rnd.randint(150, 190)
    d.rectangle([cx - bw // 2, base - bh, cx + bw // 2, base], fill=(g, g, g - 2))
    d.rectangle([cx - bw // 2, base - bh, cx - bw // 2 + bw // 7, base], fill=(g - 22, g - 22, g - 24))
    return im

BAR = [(0, 158, 224), (226, 0, 122), (255, 237, 0), (30, 30, 30), (226, 35, 26), (0, 150, 64), (45, 46, 131), (255, 106, 19), (243, 243, 242), (160, 160, 160)]

def caption(im, slug, i):
    d = ImageDraw.Draw(im)
    # printed colour bar (a proofing convention): makes each lamp's effect on colour visible
    for k, c in enumerate(BAR):
        d.rectangle([W - 48 - (len(BAR) - k) * 54, H - 92, W - 48 - (len(BAR) - k - 1) * 54 - 6, H - 50], fill=c)
    f = ImageFont.truetype(MONO, 26)
    d.text((48, H - 70), f'PLACEHOLDER · {slug.upper()} · DELIVERABLE {i:02d}', font=f, fill=(110, 110, 106))
    d.text((48, 40), 'REAL IMAGE IMPORTS FROM THE LIVE SITE', font=ImageFont.truetype(MONO, 20), fill=(150, 150, 146))
    return im

for s_i, slug in enumerate(SLUGS):
    out = os.path.join(ROOT, slug)
    os.makedirs(out, exist_ok=True)
    for i in range(1, 7):
        path = os.path.join(out, f'{i:02d}.webp')
        im = caption(block(sweep(s_i * 10 + i), s_i * 10 + i), slug, i)
        im.save(path, 'WEBP', quality=72, method=6)

# UV test masks for Too Yumm 01 + 02 (the photo layout: block centred, colour bar bottom-right)
GMONO = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'geist', 'dist', 'fonts', 'geist-mono', 'GeistMono-Medium.ttf')

def bar_rect(k):
    x1 = W - 48 - (len(BAR) - k - 1) * 54 - 6
    return (W - 48 - (len(BAR) - k) * 54, H - 92, x1, H - 50)

def dim_h(d, x0, x1, y, label, f):
    d.line([x0, y, x1, y], fill=255, width=3)
    for x in (x0, x1):
        d.line([x, y - 14, x, y + 14], fill=255, width=3)
    tw = d.textlength(label, font=f)
    d.rectangle([(x0 + x1) / 2 - tw / 2 - 10, y - 16, (x0 + x1) / 2 + tw / 2 + 10, y + 16], fill=0)
    d.text(((x0 + x1) / 2 - tw / 2, y - 12), label, font=f, fill=255)

def callout(d, px, py, tx, ty, label, f, left=True):
    d.ellipse([px - 6, py - 6, px + 6, py + 6], fill=255)
    d.line([px, py, tx, ty], fill=255, width=3)
    tw = d.textlength(label, font=f)
    end = tx - tw - 24 if left else tx + tw + 24
    d.line([tx, ty, end, ty], fill=255, width=3)
    d.text((min(tx, end) + 12, ty - 34), label, font=f, fill=255)

for i in (1, 2):
    base = os.path.join(ROOT, 'too-yumm')
    # fluorMask: only the paper-white patch and one fluorescent (magenta) ink fluoresce, subtly; never a wash
    fl = Image.new('RGB', (W, H), (0, 0, 0))
    fd = ImageDraw.Draw(fl)
    fd.rectangle(bar_rect(8), fill=(150, 150, 185))
    fd.rectangle(bar_rect(1), fill=(170, 50, 130))
    fl.filter(ImageFilter.GaussianBlur(1.5)).save(os.path.join(base, f'{i:02d}-fluor.webp'), 'WEBP', quality=85)
    # uvInk: a proofer's marks in technical pen: dimension lines, centre cross, rules, short mono callouts
    ink = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(ink)
    f = ImageFont.truetype(GMONO, 28)
    rnd = random.Random(i * 10 + 1)
    # block geometry as generated in block(): reproduce its size/position for this seed
    rnd2 = random.Random(i)
    bw, bh = rnd2.randint(320, 560), rnd2.randint(380, 640)
    cx = W // 2 + rnd2.randint(-160, 160)
    basey = int(H * 0.74)
    dim_h(d, cx - bw // 2, cx + bw // 2, basey - bh - 60, f'W {int(bw * 0.3)} MM', f)
    d.line([cx - bw // 2 - 70, basey, cx + bw // 2 + 70, basey], fill=255, width=2)
    d.text((cx + bw // 2 + 80, basey - 16), 'SHELF LINE', font=f, fill=255)
    d.line([cx - 22, basey - bh // 2, cx + 22, basey - bh // 2], fill=255, width=3)
    d.line([cx, basey - bh // 2 - 22, cx, basey - bh // 2 + 22], fill=255, width=3)
    callout(d, cx - bw // 2 + 30, basey - bh + 60, cx - bw // 2 - 90, basey - bh + 20, 'READS AT 2 M', f, left=True)
    mx0, my0, mx1, my1 = bar_rect(1)
    callout(d, (mx0 + mx1) // 2, my0, (mx0 + mx1) // 2 - 60, my0 - 90, 'M 100 · FLUORESCES', f, left=True)
    ink.save(os.path.join(base, f'{i:02d}-uvink.webp'), 'WEBP', quality=85)
print('ok')
