/**
 * L3 (09B): the shelf's ambient occlusion, baked from its own geometry (components/booth/shelf.ts)
 * into its own uv1 atlas, the same way tools/bake-booth.mjs bakes the cabinet: a signed distance
 * field of the unit, marched out along each texel's normal. The shelf is new geometry outside the
 * frozen room file; it has its own maps and, once approved, its own lock (tools/booth-shelf.lock).
 *
 *   node --experimental-strip-types tools/bake-shelf.mjs            all three: ao-shelf2/3/4.png
 *   LAYOUT=shelf2 node --experimental-strip-types tools/bake-shelf.mjs
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { Vector3 } from 'three';
import { fileURLToPath } from 'url';
import { SHELF } from '../components/booth/shelf.ts';
import { SHELF_ATLAS, shelfParts } from '../components/booth/shelfGeometry.ts';
import { layoutDef } from '../components/booth/staging.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const which = process.env.LAYOUT ? [process.env.LAYOUT] : ['shelf2', 'shelf3', 'shelf4'];

const sdBox = (p, b, r) => {
  const qx = Math.abs(p[0]) - b[0] + r, qy = Math.abs(p[1]) - b[1] + r, qz = Math.abs(p[2]) - b[2] + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};
const STEPS = [0.008, 0.02, 0.04, 0.07, 0.11, 0.16];

const hashes = [];
for (const key of which) {
  const L = layoutDef(key);
  const parts = shelfParts(L.shelf.cols, L.staging);
  // every solid of the unit as a box (centre, half size): the bounding box of each part
  const solids = parts
    .filter((p) => p.role !== 'label')
    .map((p) => {
      p.geometry.computeBoundingBox();
      const bb = p.geometry.boundingBox;
      return { c: [p.position[0], p.position[1], p.position[2]], b: [(bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2], r: SHELF.chamfer, part: p };
    });
  // the page the unit stands on: a floor plane at y = 0
  const sdf = (p) => {
    let d = p[1];
    for (const s of solids) d = Math.min(d, sdBox([p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]], s.b, s.r));
    return d;
  };
  const ao = (p, n) => {
    let occ = 0, w = 1;
    for (const h of STEPS) {
      occ += Math.max(0, h - sdf([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h])) * w;
      w *= 0.62;
    }
    return Math.min(1, Math.max(0.35, 1 - 5.2 * occ));
  };

  const N = SHELF_ATLAS.size;
  const img = new Float32Array(N * N).fill(-1);
  for (const part of parts) {
    if (part.role === 'label') continue; // the rails are plain anodised plates
    const g = part.geometry;
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv1 = g.getAttribute('uv1');
    const index = g.index;
    const tri = index ? index.count / 3 : pos.count / 3;
    const P = new Vector3(), Nn = new Vector3();
    for (let t = 0; t < tri; t++) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(t * 3 + k) : t * 3 + k));
      const uvs = ids.map((i) => [uv1.getX(i) * N, (1 - uv1.getY(i)) * N]);
      const minX = Math.max(0, Math.floor(Math.min(...uvs.map((u) => u[0])) - 1)), maxX = Math.min(N - 1, Math.ceil(Math.max(...uvs.map((u) => u[0])) + 1));
      const minY = Math.max(0, Math.floor(Math.min(...uvs.map((u) => u[1])) - 1)), maxY = Math.min(N - 1, Math.ceil(Math.max(...uvs.map((u) => u[1])) + 1));
      const [a, b, c] = uvs;
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) continue;
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den;
          const w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
          const w2 = 1 - w0 - w1;
          if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
          const wts = [w0, w1, w2];
          P.set(0, 0, 0);
          Nn.set(0, 0, 0);
          ids.forEach((i, k) => {
            P.x += pos.getX(i) * wts[k];
            P.y += pos.getY(i) * wts[k];
            P.z += pos.getZ(i) * wts[k];
            Nn.x += nor.getX(i) * wts[k];
            Nn.y += nor.getY(i) * wts[k];
            Nn.z += nor.getZ(i) * wts[k];
          });
          P.x += part.position[0];
          P.y += part.position[1];
          P.z += part.position[2];
          Nn.normalize();
          const p = [P.x + Nn.x * 0.0015, P.y + Nn.y * 0.0015, P.z + Nn.z * 0.0015];
          const v = ao(p, [Nn.x, Nn.y, Nn.z]);
          const i = y * N + x;
          img[i] = img[i] < 0 ? v : Math.min(img[i], v);
        }
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    const src = img.slice();
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (src[i] >= 0) continue;
        let s = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          const v = src[yy * N + xx];
          if (v >= 0) (s += v), n++;
        }
        if (n) img[i] = s / n;
      }
  }
  const bytes = Buffer.alloc(N * N);
  let lo = 1, sum = 0, cnt = 0;
  for (let i = 0; i < img.length; i++) {
    const v = img[i] < 0 ? 1 : img[i];
    bytes[i] = Math.round(v * 255);
    if (img[i] >= 0) (lo = Math.min(lo, v)), (sum += v), cnt++;
  }
  const out = join(ROOT, 'public/booth', `ao-${key}.png`);
  await sharp(bytes, { raw: { width: N, height: N, channels: 1 } }).png({ compressionLevel: 9 }).toFile(out);
  console.log(`ao-${key}.png: ${N}², ${cnt} texels, min ${lo.toFixed(2)}, mean ${(sum / cnt).toFixed(3)}`);
  // the unit's geometry hash (positions of every part), for the lock once Vish approves the shelf
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(p.name + p.position.join(','));
    h.update(Buffer.from(p.geometry.getAttribute('position').array.buffer));
  }
  hashes.push(`${key} ${h.digest('hex')}`);
}
const lock = join(ROOT, 'tools/booth-shelf.lock');
if (process.env.SHELF_LOCK === '1') {
  writeFileSync(lock, `${hashes.join('\n')}\n# L3 (09B): the shelf's geometry hash per arrangement (tools/bake-shelf.mjs). Written with SHELF_LOCK=1 once Vish\n# approved the shelf; after that a change needs his approval and a new lock.\n`);
  console.log('tools/booth-shelf.lock written');
} else if (existsSync(lock)) {
  const had = readFileSync(lock, 'utf8').split('\n').filter((l) => /^shelf\d /.test(l));
  for (const line of hashes) if (!had.includes(line)) console.log(`note: ${line.split(' ')[0]} differs from tools/booth-shelf.lock (SHELF_LOCK=1 to accept)`);
}
else console.log(`not locked yet (the shelf is frozen once Vish approves it: SHELF_LOCK=1):\n  ${hashes.join('\n  ')}`);
