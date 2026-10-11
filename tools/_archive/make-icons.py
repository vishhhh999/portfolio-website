"""
Favicon set + web manifest icons, drawn from one geometry: the viewing booth seen head-on
(dark cabinet, N7 grey interior, a lit diffuser strip under the header, one sample on the floor).

  python3 tools/make-icons.py
  → app/icon.svg, app/favicon.ico, app/apple-icon.png (180), public/icon-192.png,
    public/icon-512.png, public/icon-maskable-512.png
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
HOUSING, INTERIOR, DIFFUSER, SAMPLE, PAPER = '#1B1B1A', '#A8A8A6', '#F2F0EA', '#111111', '#F2F0EA'

# geometry on a 32-unit grid
CAB = (2, 4, 30, 28)      # cabinet face
OPEN = (5, 9, 27, 25)     # the opening
STRIP = (8, 10, 24, 11.5) # diffuser
SAMPLE_R = (12.5, 16.5, 19.5, 22)  # one sample...
PLINTH = (10, 22, 22, 25)        # ...on its plinth
RADIUS = 2.2

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="{CAB[0]}" y="{CAB[1]}" width="{CAB[2]-CAB[0]}" height="{CAB[3]-CAB[1]}" rx="{RADIUS}" fill="{HOUSING}"/>
  <rect x="{OPEN[0]}" y="{OPEN[1]}" width="{OPEN[2]-OPEN[0]}" height="{OPEN[3]-OPEN[1]}" fill="{INTERIOR}"/>
  <rect x="{STRIP[0]}" y="{STRIP[1]}" width="{STRIP[2]-STRIP[0]}" height="{STRIP[3]-STRIP[1]}" fill="{DIFFUSER}"/>
  <rect x="{PLINTH[0]}" y="{PLINTH[1]}" width="{PLINTH[2]-PLINTH[0]}" height="{PLINTH[3]-PLINTH[1]}" fill="{PAPER}"/>
  <rect x="{SAMPLE_R[0]}" y="{SAMPLE_R[1]}" width="{SAMPLE_R[2]-SAMPLE_R[0]}" height="{SAMPLE_R[3]-SAMPLE_R[1]}" fill="{SAMPLE}"/>
</svg>
'''
open(os.path.join(ROOT, 'app/icon.svg'), 'w').write(svg)


def draw(size, pad=0.0, bg=None):
    """Raster at `size` px; pad = fraction of the canvas kept clear (maskable safe zone)."""
    ss = 4
    S = size * ss
    im = Image.new('RGBA', (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    inner = S * (1 - 2 * pad)
    off = S * pad
    u = inner / 32
    box = lambda r: [off + r[0] * u, off + r[1] * u, off + r[2] * u, off + r[3] * u]
    d.rounded_rectangle(box(CAB), radius=RADIUS * u, fill=HOUSING)
    d.rectangle(box(OPEN), fill=INTERIOR)
    d.rectangle(box(STRIP), fill=DIFFUSER)
    d.rectangle(box(PLINTH), fill=PAPER)
    d.rectangle(box(SAMPLE_R), fill=SAMPLE)
    return im.resize((size, size), Image.LANCZOS)


draw(180, pad=0.06, bg=PAPER).convert('RGB').save(os.path.join(ROOT, 'app/apple-icon.png'))
draw(192).save(os.path.join(ROOT, 'public/icon-192.png'))
draw(512).save(os.path.join(ROOT, 'public/icon-512.png'))
draw(512, pad=0.12, bg=PAPER).save(os.path.join(ROOT, 'public/icon-maskable-512.png'))
ico = draw(256)
ico.save(os.path.join(ROOT, 'app/favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('icons ok')
