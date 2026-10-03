"""Encodes public/booth/poster-*.png to WebP (served) + JPEG (fallback) and removes the PNGs."""
import glob, os
from PIL import Image
for f in glob.glob(os.path.join(os.path.dirname(__file__), '..', 'public', 'booth', 'poster-*.png')):
    im = Image.open(f).convert('RGB')
    base = f[:-4]
    im.save(base + '.webp', 'WEBP', quality=78, method=6)
    if base.endswith('16x10'):
        im.save(base + '.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
    os.remove(f)
    print(os.path.basename(base), os.path.getsize(base + '.webp') // 1024, 'KB')
