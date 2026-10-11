"""F3: perceptual-hash pass over the archive. Pairs at pHash distance <= 4 (64-bit DCT hash; dHash
shown alongside) are exact or near-exact duplicates; the later piece of each pair is dropped.
   python3 tools/dedupe-archive.py   (prints the pairs and the positions to drop)"""
import glob, json, os
import imagehash
from PIL import Image

files = sorted(glob.glob('public/archive/*.webp'))
hashes = []
for f in files:
    im = Image.open(f).convert('RGB')
    hashes.append((int(os.path.basename(f)[:2]), imagehash.phash(im), imagehash.dhash(im)))

drop, pairs = set(), []
for i, (a, pa, da) in enumerate(hashes):
    for b, pb, db in hashes[i + 1:]:
        if pa - pb <= 4:
            pairs.append({'keep': a, 'drop': b, 'phash': int(pa - pb), 'dhash': int(da - db)})
            if a not in drop: drop.add(b)
print(json.dumps({'pairs': pairs, 'drop': sorted(drop), 'count_before': len(files), 'count_after': len(files) - len(drop)}, indent=1))
