"""Blue-noise dither tile (64x64, void-and-cluster, Ulichney 1993) for the relit proof shader.
   python3 tools/gen-bluenoise.py  ->  public/textures/bluenoise64.png"""
import numpy as np
from PIL import Image

N = 64
SIGMA = 1.9
rng = np.random.default_rng(7)

def kernel():
    r = np.arange(N); r = np.minimum(r, N - r)
    d2 = r[:, None] ** 2 + r[None, :] ** 2
    return np.exp(-d2 / (2 * SIGMA ** 2))

K = np.fft.rfft2(kernel())
def energy(b): return np.fft.irfft2(np.fft.rfft2(b) * K, s=(N, N))

# initial binary pattern: 10% ones, relaxed so the ones are evenly spread
b = np.zeros((N, N)); b.flat[rng.choice(N * N, N * N // 10, replace=False)] = 1
while True:
    e = energy(b)
    cluster = np.unravel_index(np.argmax(np.where(b == 1, e, -np.inf)), b.shape); b[cluster] = 0
    e = energy(b)
    void = np.unravel_index(np.argmin(np.where(b == 0, e, np.inf)), b.shape)
    if void == cluster: b[cluster] = 1; break
    b[void] = 1

rank = np.zeros((N, N), dtype=np.int64)
ones = int(b.sum()); proto = b.copy()
cur = proto.copy()
for r in range(ones - 1, -1, -1):  # remove ones from the tightest clusters
    e = energy(cur); idx = np.unravel_index(np.argmax(np.where(cur == 1, e, -np.inf)), cur.shape)
    cur[idx] = 0; rank[idx] = r
cur = proto.copy()
for r in range(ones, N * N):  # fill the largest voids
    e = energy(cur); idx = np.unravel_index(np.argmin(np.where(cur == 0, e, np.inf)), cur.shape)
    cur[idx] = 1; rank[idx] = r

img = ((rank + 0.5) / (N * N) * 256).astype(np.uint8)
Image.fromarray(img, 'L').save('public/textures/bluenoise64.png', optimize=True)
print('levels', len(np.unique(img)), 'mean', round(float(img.mean()), 2))
