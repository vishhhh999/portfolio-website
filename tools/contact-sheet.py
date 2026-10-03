"""Builds tools/lamp-review/contact-sheet.png: the 7 desktop lamp shots side by side, labelled like a proof strip."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.join(os.path.dirname(__file__), 'lamp-review')
LAMPS = [('D50', 'D50 · 5000K'), ('TL84', 'TL84 · 4000K TRIBAND'), ('A', 'A · 2856K TUNGSTEN'), ('UV', 'UV-A · 365NM'),
         ('FLOOD', 'FLOOD · 5700K'), ('SCREEN', 'SCREEN · EMISSION ONLY'), ('AFTERDARK', 'AFTER DARK · HAND LAMP')]
W, H, PAD, LABEL = 720, 450, 16, 44
mono = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 18)
sheet = Image.new('RGB', (PAD + len(LAMPS) * (W + PAD), PAD * 2 + H + LABEL + 30), (17, 17, 17))
d = ImageDraw.Draw(sheet)
for i, (lamp, label) in enumerate(LAMPS):
    im = Image.open(os.path.join(HERE, f'desktop-{i + 1}-{lamp}.png')).convert('RGB').resize((W, H), Image.LANCZOS)
    x = PAD + i * (W + PAD)
    sheet.paste(im, (x, PAD))
    d.text((x, PAD + H + 12), f'{i + 1:02d}  {label}', font=mono, fill=(220, 218, 210))
d.text((PAD, PAD + H + 44), 'VM_PROOF_LAMPS · PHASE 2 · 2026-10 · lineup shot, 1440×900, reduced motion (settled lamps)', font=mono, fill=(120, 120, 120))
sheet.save(os.path.join(HERE, 'contact-sheet.png'), optimize=True)
print('contact-sheet.png', sheet.size)
