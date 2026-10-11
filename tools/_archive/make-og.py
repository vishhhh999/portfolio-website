"""
Open Graph / Twitter cards, 1200×630, one per project from its first deliverable (the poster
frame for a video), plus a site card from the home poster. Static files in public/og/.

  python3 tools/make-og.py     (after tools/import-framer.mjs and tools/make-posters.mjs)
"""
import glob, json, os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public/og')
MONO = os.path.join(ROOT, 'node_modules/geist/dist/fonts/geist-mono/GeistMono-Medium.ttf')
SANS = os.path.join(ROOT, 'node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf')
W, H, BAR = 1200, 630, 96
PAPER, INK = (242, 240, 234), (17, 17, 17)
os.makedirs(OUT, exist_ok=True)

src = open(os.path.join(ROOT, 'content/work/imported.ts')).read()
imported = json.loads(src[src.index('= {') + 2: src.rstrip().rindex('}') + 1])


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def card(photo, title, meta, out):
    c = Image.new('RGB', (W, H), PAPER)
    c.paste(cover(photo.convert('RGB'), W, H - BAR), (0, 0))
    d = ImageDraw.Draw(c)
    d.line([0, H - BAR, W, H - BAR], fill=INK, width=2)
    d.text((40, H - BAR + 22), title, font=ImageFont.truetype(SANS, 40), fill=INK)
    m = ImageFont.truetype(MONO, 17)
    d.text((W - 40 - d.textlength(meta, font=m), H - BAR + 28), meta, font=m, fill=INK)
    d.text((W - 40 - d.textlength('VISHESH MAHENDRU', font=m), H - BAR + 54), 'VISHESH MAHENDRU', font=m, fill=(110, 110, 110))
    c.save(out, 'JPEG', quality=84, optimize=True, progressive=True)


for f in sorted(glob.glob(os.path.join(ROOT, 'content/work/*.ts'))):
    slug = os.path.basename(f)[:-3]
    if slug in ('index', 'imported', '_placeholder'):
        continue
    ts = open(f).read()
    title = re.search(r"title: '([^']+)'", ts).group(1)
    first = (imported.get(slug, {}).get('deliverables') or [None])[0]
    if not first:
        print('skip', slug)
        continue
    path = first.get('poster') or first['src']
    year = imported[slug].get('year', '')
    scope = imported[slug].get('scope', '')
    card(Image.open(os.path.join(ROOT, 'public', path.lstrip('/'))), title, f'{scope} · {year}'.strip(' ·'), os.path.join(OUT, f'{slug}.jpg'))
    print('og', slug)

card(Image.open(os.path.join(ROOT, 'public/booth/poster-16x10.jpg')), 'Tested under every light.', 'BRAND + DIGITAL DESIGN · INDIA', os.path.join(OUT, 'site.jpg'))
print('og site')
