"""
tools/lamp-review/contact-sheet.png: one sheet with
  row 1  lineup shot, all 7 lamps, desktop 1440
  row 2  lineup shot, all 7 lamps, mobile 390
  row 3  Too Yumm proof strip under D50 / A / UV / AFTER DARK, desktop + mobile
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.join(os.path.dirname(__file__), 'lamp-review')
LAMPS = [('D50', 'D50 · 5000K'), ('TL84', 'TL84 · TRIBAND'), ('A', 'A · 2856K'), ('UV', 'UV-A · 365NM'),
         ('FLOOD', 'FLOOD · 5700K'), ('SCREEN', 'SCREEN · EMISSION'), ('AFTERDARK', 'AFTER DARK · TORCH')]
PROOF = ['D50', 'A', 'UV', 'AFTERDARK']
mono = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 18)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 15)
PAD, LAB = 16, 34
DW, DH = 560, 350       # desktop thumbs
MW, MH = 162, 350       # mobile thumbs

def load(name, size):
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        im = Image.new('RGB', size, (40, 40, 40))
        ImageDraw.Draw(im).text((10, 10), 'missing: ' + name, font=small, fill=(200, 80, 80))
        return im
    return Image.open(p).convert('RGB').resize(size, Image.LANCZOS)

width = PAD + 7 * (DW + PAD)
rows_h = [DH + LAB, MH + LAB, DH + LAB]
sheet = Image.new('RGB', (width, PAD + sum(h + PAD for h in rows_h) + 40), (17, 17, 17))
d = ImageDraw.Draw(sheet)
y = PAD
for i, (lamp, label) in enumerate(LAMPS):
    x = PAD + i * (DW + PAD)
    sheet.paste(load(f'desktop-{i + 1}-{lamp}.png', (DW, DH)), (x, y))
    d.text((x, y + DH + 8), f'{i + 1:02d}  {label}', font=mono, fill=(220, 218, 210))
y += DH + LAB + PAD
for i, (lamp, label) in enumerate(LAMPS):
    x = PAD + i * (DW + PAD)
    sheet.paste(load(f'mobile-{i + 1}-{lamp}.png', (MW, MH)), (x, y))
    d.text((x, y + MH + 8), f'{i + 1:02d}  mobile', font=small, fill=(160, 160, 155))
y += MH + LAB + PAD
x = PAD
for lamp in PROOF:
    sheet.paste(load(f'desktop-proof-{lamp}.png', (DW, DH)), (x, y))
    d.text((x, y + DH + 8), f'TOO YUMM PROOF STRIP · {lamp}', font=mono, fill=(220, 218, 210))
    x += DW + PAD
for lamp in PROOF:
    sheet.paste(load(f'mobile-proof-{lamp}.png', (MW, DH)), (x, y))
    d.text((x, y + DH + 8), f'mobile · {lamp}', font=small, fill=(160, 160, 155))
    x += MW + PAD
d.text((PAD, sheet.height - 30), 'VM_PROOF_LAMPS · PHASE 3 · 2026-10 · CPU-rendered (SwiftShader): check FLOOD + bloom on a real GPU', font=small, fill=(120, 120, 120))
sheet.save(os.path.join(HERE, 'contact-sheet.png'), optimize=True)
print('contact-sheet.png', sheet.size)
