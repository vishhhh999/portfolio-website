"""
Generates the Phase 2 placeholder assets. Re-run any time:  python3 tools/gen-assets.py
Needs Pillow + numpy, and ffmpeg on PATH for the test video.

Outputs (all replaceable with real files of the same name):
  public/textures/checker24.png       24-patch colour checker, published sRGB values
  public/textures/card_base.png       calibration card: paper + printed swatch strip
  public/textures/card_fluor.png      fluorMask test: paper OBA white + one fluorescent ink patch
  public/textures/card_uvink.png      uvInk test: proofer's grid + handwritten-style marks
  public/textures/gobo_torch.png      AFTER DARK hand-lamp cookie
  public/media/screen-test.webm/.mp4  looping test video for SCREEN placeholders
  public/media/screen-test-poster.webp still frame for screens under every other lamp
  public/sounds/click.wav, hum_tl84.wav, buzz_uv.wav
"""
import math, os, random, subprocess, shutil, tempfile, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
TEX = os.path.join(ROOT, 'textures')
random.seed(7)

def font(name, size):
    for p in [f'/usr/share/fonts/truetype/dejavu/{name}', f'/usr/share/fonts/truetype/freefont/{name}']:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

MONO = 'DejaVuSansMono.ttf'
HAND = 'FreeSansOblique.ttf'

# ── 24-patch checker ──────────────────────────────────────────────
# sRGB values of the classic 24-patch chart as published (X-Rite / BabelColor, D65 sRGB).
CHECKER = [
    (115, 82, 68), (194, 150, 130), (98, 122, 157), (87, 108, 67), (133, 128, 177), (103, 189, 170),
    (214, 126, 44), (80, 91, 166), (193, 90, 99), (94, 60, 108), (157, 188, 64), (224, 163, 46),
    (56, 61, 150), (70, 148, 73), (175, 54, 60), (231, 199, 31), (187, 86, 149), (8, 133, 161),
    (243, 243, 242), (200, 200, 200), (160, 160, 160), (122, 122, 121), (85, 85, 85), (52, 52, 52),
]

def checker():
    W, H = 1116, 864  # 279 × 216 mm at 4 px/mm
    img = Image.new('RGB', (W, H), (22, 22, 22))
    d = ImageDraw.Draw(img)
    px = 4
    patch, gap = 40 * px, 5 * px
    gw, gh = 6 * patch + 5 * gap, 4 * patch + 3 * gap
    ox, oy = (W - gw) // 2, (H - gh) // 2 + 6 * px
    for i, c in enumerate(CHECKER):
        r, col = divmod(i, 6)
        x, y = ox + col * (patch + gap), oy + r * (patch + gap)
        d.rounded_rectangle([x, y, x + patch, y + patch], radius=6, fill=c)
    d.text((ox, 9 * px), 'COLOUR CHECKER · 24', font=font(MONO, 30), fill=(150, 150, 150))
    d.text((W - ox - 260, 9 * px), 'VM BOOTH 01', font=font(MONO, 30), fill=(150, 150, 150))
    img.save(os.path.join(TEX, 'checker24.png'), optimize=True)

# ── calibration card ──────────────────────────────────────────────
CW, CH = 1200, 800  # 150 × 100 mm at 8 px/mm
PAPER = (244, 242, 236)
SWATCHES = [  # printed strip: CMYK solids + 50% tints, RGB overprints, one spot, one fluorescent
    ('C', (0, 158, 224)), ('M', (226, 0, 122)), ('Y', (255, 237, 0)), ('K', (30, 30, 30)),
    ('C50', (128, 205, 240)), ('M50', (240, 140, 186)), ('Y50', (255, 245, 140)), ('K50', (150, 150, 150)),
    ('R', (226, 35, 26)), ('G', (0, 150, 64)), ('B', (45, 46, 131)), ('SPOT', (255, 106, 19)),
    ('NEON', (255, 72, 176)),
]
NEON_INDEX = len(SWATCHES) - 1

def swatch_rects():
    n = len(SWATCHES)
    margin, top, h = 60, 520, 150
    w = (CW - 2 * margin) / n
    return [(int(margin + i * w), top, int(margin + (i + 1) * w) - 4, top + h) for i in range(n)]

def crop_marks(d, colour, inset=26, l=22):
    for (x, y, sx, sy) in [(inset, inset, 1, 1), (CW - inset, inset, -1, 1), (inset, CH - inset, 1, -1), (CW - inset, CH - inset, -1, -1)]:
        d.line([x, y, x + sx * l, y], fill=colour, width=2)
        d.line([x, y, x, y + sy * l], fill=colour, width=2)

def reg_target(d, cx, cy, colour, r=18):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=colour, width=2)
    d.ellipse([cx - r / 2, cy - r / 2, cx + r / 2, cy + r / 2], outline=colour, width=2)
    d.line([cx - r - 6, cy, cx + r + 6, cy], fill=colour, width=2)
    d.line([cx, cy - r - 6, cx, cy + r + 6], fill=colour, width=2)

def card():
    base = Image.new('RGB', (CW, CH), PAPER)
    d = ImageDraw.Draw(base)
    crop_marks(d, (40, 40, 40))
    reg_target(d, 90, 90, (40, 40, 40)); reg_target(d, CW - 90, 90, (40, 40, 40))
    d.text((150, 70), 'CALIBRATION CARD', font=font(MONO, 44), fill=(25, 25, 25))
    d.text((150, 128), 'VM_PROOF_0000 · ALL ILLUMINANTS · 2026-10', font=font(MONO, 22), fill=(90, 90, 90))
    d.text((150, 300), 'Same colour.\nDifferent light.', font=font('DejaVuSans-Bold.ttf', 62), fill=(25, 25, 25), spacing=6)
    for (label, c), (x0, y0, x1, y1) in zip(SWATCHES, swatch_rects()):
        d.rectangle([x0, y0, x1, y1], fill=c)
        d.text((x0 + 4, y1 + 8), label, font=font(MONO, 16), fill=(70, 70, 70))
    base.save(os.path.join(TEX, 'card_base.png'), optimize=True)

    # fluorMask: RGB = emission tint. Paper OBAs glow violet-white; ink and text absorb; the neon patch glows pink.
    fl = Image.new('RGB', (CW, CH), (255, 255, 255))
    fd = ImageDraw.Draw(fl)
    ink = np.array(base).astype(np.int32)
    printed = (np.abs(ink - np.array(PAPER)).sum(axis=2) > 40)
    arr = np.array(fl)
    arr[printed] = (0, 0, 0)
    fl = Image.fromarray(arr)
    fd = ImageDraw.Draw(fl)
    x0, y0, x1, y1 = swatch_rects()[NEON_INDEX]
    fd.rectangle([x0, y0, x1, y1], fill=(255, 80, 190))
    fl = fl.filter(ImageFilter.GaussianBlur(0.8))
    fl.save(os.path.join(TEX, 'card_fluor.png'), optimize=True)

    # uvInk: proofer's hidden marks. Black = nothing, white = fluorescent ink.
    uv = Image.new('L', (CW, CH), 0)
    ud = ImageDraw.Draw(uv)
    for x in range(60, CW - 59, 60):
        ud.line([x, 40, x, CH - 40], fill=70, width=1)
    for y in range(40, CH - 39, 60):
        ud.line([60, y, CW - 60, y], fill=70, width=1)
    hand = font(HAND, 34)

    def jitter_line(pts, w=4):
        out = []
        for (x, y) in pts:
            out.append((x + random.uniform(-1.5, 1.5), y + random.uniform(-1.5, 1.5)))
        ud.line(out, fill=255, width=w, joint='curve')

    # circle the neon patch
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    pts = [(cx + 62 * math.cos(t) * (1 + 0.04 * math.sin(3 * t)), cy + 92 * math.sin(t)) for t in np.linspace(0.2, 2 * math.pi + 0.5, 60)]
    jitter_line(pts)
    ud.text((x0 - 300, y0 - 70), 'fluoresces: keep off\npaper-white areas', font=hand, fill=255)
    jitter_line([(x0 - 60, y0 - 20), (x0 - 10, y0 + 30)])
    # tick the K patch, note on magenta
    kx0, ky0, kx1, ky1 = swatch_rects()[3]
    jitter_line([(kx0 + 10, ky0 + 80), (kx0 + 30, ky0 + 110), (kx1 - 5, ky0 + 40)], 5)
    mx0, my0, _, _ = swatch_rects()[1]
    ud.text((mx0 - 40, my0 - 112), 'check M\nunder TL84', font=hand, fill=255)
    ud.text((720, 300), 'OBA ✓   dE < 2', font=font(HAND, 44), fill=255)
    jitter_line([(700, 360), (1100, 356)], 3)
    uv.save(os.path.join(TEX, 'card_uvink.png'), optimize=True)

# ── gobo ──────────────────────────────────────────────────────────
def gobo():
    S = 512
    y, x = np.mgrid[0:S, 0:S]
    r = np.hypot(x - S / 2, y - S / 2) / (S / 2)
    hot = np.exp(-(r / 0.42) ** 2)                       # hot spot
    body = np.clip(1 - (r / 0.86) ** 6, 0, 1) * 0.55     # spill
    ring = 0.12 * np.exp(-((r - 0.62) / 0.03) ** 2)      # reflector ring
    rng = np.random.default_rng(3)
    dust = rng.normal(0, 0.035, (S, S))
    img = np.clip((hot * 0.75 + body + ring) * (1 + dust), 0, 1)
    img[r > 0.98] = 0
    Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).convert('RGB').save(os.path.join(TEX, 'gobo_torch.png'), optimize=True)

# ── test video ────────────────────────────────────────────────────
def video():
    if not shutil.which('ffmpeg'):
        print('ffmpeg missing, skipping video'); return
    W, H, FPS, SECS = 768, 432, 24, 6
    palette = [(46, 52, 196), (240, 120, 30), (20, 170, 150), (210, 40, 140), (245, 245, 240), (20, 20, 24)]
    tmp = tempfile.mkdtemp()
    f_title = font('DejaVuSans-Bold.ttf', 34)
    f_mono = font(MONO, 14)
    for i in range(FPS * SECS):
        t = i / FPS
        img = Image.new('RGB', (W, H), (12, 12, 14))
        d = ImageDraw.Draw(img)
        # three panels, one per screen region; each cycles colour on its own phase so the spill differs per device
        for p, (x0, x1) in enumerate([(0, 384), (384, 576), (576, 768)]):
            k = int((t * 0.5 + p * 0.37) * len(palette)) % 4
            bg = palette[k]
            d.rectangle([x0, 0, x1, H], fill=bg)
            ink = (255, 255, 255) if sum(bg) < 500 else (20, 20, 24)
            off = (t * 40 + p * 90) % 120
            d.text((x0 + 18, 22), ['MITOOSHI', 'SONDE', 'HEX'][p], font=f_title if p == 0 else f_mono, fill=ink)
            for row in range(8):
                yy = 90 + row * 40 - off
                if 70 < yy < H - 20:
                    d.rectangle([x0 + 18, yy, x0 + 18 + (x1 - x0 - 36) * (0.4 + 0.5 * ((row * 7 + p) % 5) / 5), yy + 12], fill=ink)
            d.text((x0 + 18, H - 26), f'{t:4.1f}s', font=f_mono, fill=ink)
        img.save(os.path.join(tmp, f'f{i:04d}.png'))
    out = os.path.join(ROOT, 'media')
    common = ['-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%04d.png')]
    subprocess.run(['ffmpeg', *common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', os.path.join(out, 'screen-test.webm')], check=True)
    subprocess.run(['ffmpeg', *common, '-c:v', 'libx264', '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', os.path.join(out, 'screen-test.mp4')], check=True)
    # still frame shown on screens under every lamp except SCREEN (devices are on, video only plays in SCREEN)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.2', '-i', os.path.join(out, 'screen-test.webm'), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', os.path.join(out, 'screen-test-poster.webp')], check=True)
    shutil.rmtree(tmp)

# ── sounds ────────────────────────────────────────────────────────
SR = 22050

def write_wav(name, samples):
    data = (np.clip(samples, -1, 1) * 32767).astype('<i2')
    with wave.open(os.path.join(ROOT, 'sounds', name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

def sounds():
    rng = np.random.default_rng(11)
    # rocker click: two short transients (snap + seat)
    n = int(SR * 0.06)
    t = np.arange(n) / SR
    click = rng.normal(0, 1, n) * np.exp(-t * 900) * 0.8
    seat = np.zeros(n); s0 = int(SR * 0.018)
    seat[s0:] = rng.normal(0, 1, n - s0) * np.exp(-(t[s0:] - t[s0]) * 1400) * 0.45
    tone = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 600) * 0.25
    write_wav('click.wav', click + seat + tone)
    # TL84 ballast hum: 100 Hz + harmonics, exactly 1 s so it loops seamlessly
    t = np.arange(SR) / SR
    hum = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(100, 0.5), (200, 0.22), (300, 0.12), (500, 0.05), (700, 0.03)])
    write_wav('hum_tl84.wav', hum * 0.5)
    # UV buzz: brighter, rougher 120 Hz with a little noise
    saw = 2 * ((t * 120) % 1) - 1
    buzz = 0.35 * saw + 0.15 * np.sin(2 * np.pi * 240 * t) + rng.normal(0, 0.03, SR)
    write_wav('buzz_uv.wav', buzz * 0.5)

if __name__ == '__main__':
    checker(); card(); gobo(); sounds(); video()
    for d in ['textures', 'sounds', 'media']:
        for f in sorted(os.listdir(os.path.join(ROOT, d))):
            print(f'{d}/{f}', os.path.getsize(os.path.join(ROOT, d, f)) // 1024, 'KB')
