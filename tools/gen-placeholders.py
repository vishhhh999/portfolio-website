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

# UV test masks for Too Yumm 01 + 02
for i in (1, 2):
    base = os.path.join(ROOT, 'too-yumm')
    fl = Image.new('RGB', (W, H), (0, 0, 0))
    fd = ImageDraw.Draw(fl)
    fd.rectangle([0, 0, W, int(H * 0.62)], fill=(150, 150, 170))   # the paper sweep's optical brighteners
    fd.rectangle([W // 2 - 120, int(H * 0.30), W // 2 + 120, int(H * 0.40)], fill=(255, 90, 200))  # one fluorescent ink patch
    fl.filter(ImageFilter.GaussianBlur(3)).save(os.path.join(base, f'{i:02d}-fluor.webp'), 'WEBP', quality=80)
    ink = Image.new('L', (W, H), 0)
    idr = ImageDraw.Draw(ink)
    for x in range(100, W, 100):
        idr.line([x, 80, x, H - 80], fill=60, width=2)
    hand = ImageFont.truetype(HAND, 54)
    idr.text((140, 160), 'window reads at 2m', font=hand, fill=255)
    idr.text((980, 260), 'cap height = 1/12 trim', font=hand, fill=255)
    idr.ellipse([W // 2 - 190, int(H * 0.26), W // 2 + 190, int(H * 0.44)], outline=255, width=6)
    idr.line([300, 230, W // 2 - 190, int(H * 0.33)], fill=255, width=5)
    ink.save(os.path.join(base, f'{i:02d}-uvink.webp'), 'WEBP', quality=80)
print('ok')
