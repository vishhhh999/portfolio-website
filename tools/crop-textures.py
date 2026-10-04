"""Texture crops for the procedural booth objects (D3), cut from each project's own stills, never
drawn: python3 tools/crop-textures.py  ->  public/booth/textures/<slug>/*.webp + manifest.json
(which still, which crop rectangle in that still's pixels)."""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
# slug: [(name, still, (left, top, right, bottom) as fractions of the still, output long edge, note)]
CROPS = {
    'bengal-t20': [
        ('flag', '03.webp', (0.18, 0.19, 0.78, 0.60), 1024, 'tiger wall art on the stadium (flag face)'),
        ('ticket', '02.webp', (0.31, 0.244, 0.68, 0.395), 768, 'BENGAL T20 LEAGUE banner on the big screen (match ticket face)'),
        ('swatch-folk', '05.webp', (0.00, 0.02, 0.30, 0.50), 512, 'folk-art backdrop pattern (jersey swatch)'),
        ('swatch-tiger', '06.webp', (0.07, 0.04, 0.62, 0.39), 512, 'tiger pair on the auction backdrop (jersey swatch)'),
        ('swatch-rays', '03.webp', (0.04, 0.30, 0.20, 0.60), 512, 'yellow rays on blue from the wall art (jersey swatch)'),
    ],
}

for slug, crops in CROPS.items():
    out = os.path.join(ROOT, 'public/booth/textures', slug)
    os.makedirs(out, exist_ok=True)
    manifest = []
    for name, still, (l, t, r, b), edge, note in crops:
        src = os.path.join(ROOT, 'public/work', slug, still)
        im = Image.open(src).convert('RGB')
        box = (round(l * im.width), round(t * im.height), round(r * im.width), round(b * im.height))
        c = im.crop(box)
        s = edge / max(c.size)
        c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
        c.save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=88, method=6)
        manifest.append({'file': f'{name}.webp', 'still': f'/work/{slug}/{still}', 'cropPx': {'left': box[0], 'top': box[1], 'width': box[2] - box[0], 'height': box[3] - box[1]}, 'size': list(c.size), 'note': note})
    with open(os.path.join(out, 'manifest.json'), 'w') as f:
        json.dump({'slug': slug, 'rule': 'Crops of the project\'s own stills only; nothing drawn.', 'crops': manifest}, f, indent=2)
    print(slug, len(manifest), 'crops')
