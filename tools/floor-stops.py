"""Floor evenness from lamp-review screenshots: linear luminance of the floor just in front of the plinths vs the front edge of frame (left of the tray)."""
import sys, glob, os, math
import numpy as np
from PIL import Image

def lin(v):
    v = v / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)

for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'lamp-review', 'desktop-*.png'))):
    a = np.asarray(Image.open(f).convert('RGB')).astype(float)
    h, w, _ = a.shape
    def band(y0, y1):
        reg = lin(a[int(y0 * h):int(y1 * h), int(0.02 * w):int(0.28 * w)])
        return float((0.2126 * reg[..., 0] + 0.7152 * reg[..., 1] + 0.0722 * reg[..., 2]).mean())
    back, front = band(0.775, 0.79), band(0.965, 0.995)
    stops = abs(math.log2(max(back, 1e-5) / max(front, 1e-5)))
    print(f'{os.path.basename(f):28s} back {back:.3f}  front {front:.3f}  Δ {stops:.2f} stops')
