/**
 * Booth bake prep (D6) and the mobile AO bake (D2). Run with Node's TypeScript stripping, so it
 * uses the site's own staging and shell geometry:
 *
 *   node --experimental-strip-types tools/bake-booth.mjs
 *
 * Writes:
 *   public/booth/ao.png          ambient occlusion over the shell atlas (uv1): coves, corners, the
 *                                lip, the shelf, and each base's own faces. Computed from the
 *                                geometry with a signed distance field (no light, no objects).
 *   tools/booth-room.glb         the room only (interior, frame, hood, diffuser, housing, lip), at the
 *                                exact site scale, with TEXCOORD_1 = the same non-overlapping atlas.
 *                                Bake a Blender lightmap onto TEXCOORD_1 and save it in public/booth/
 *                                (lightmap.exr / .png, converted to lightmap.ktx2): the site uses it
 *                                automatically (tinted per lamp) when it exists.
 *   tools/camera.json            lens and shots for Blender (tools/blender_camera.py).
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { Euler, Quaternion, Vector3 } from 'three';
import { fileURLToPath } from 'url';
import { ATLAS, shellParts } from '../components/booth/shell.ts';
import { cabinetShot, trayShot } from '../components/booth/shots.ts';
import { BOOTH, CABINET_FACE, COVE, EYE, FACE_Z, FOCAL_MM, FOV, HOOD, LIP, PROPS, SENSOR_HEIGHT_MM, STAGING, TRAY } from '../components/booth/staging.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// the booth lineup, in content order (content/work/index.ts; the bases follow STAGING)
const LINEUP = ['too-yumm', 'jsw-sports', 'mitooshi', 'sonde', 'house-of-hex', 'bengal-t20', 'sook', 'shunya', 'indo-thai'];
const parts = shellParts(LINEUP);

// ── signed distance field of the static booth (positive in free space) ──────────────────────
const sdRoundBox = (p, b, r) => {
  const qx = Math.abs(p[0]) - b[0] + r, qy = Math.abs(p[1]) - b[1] + r, qz = Math.abs(p[2]) - b[2] + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};
const depthExt = BOOTH.frontZ - BOOTH.backZ + 0.04;
const interiorC = [0, BOOTH.height / 2, (BOOTH.backZ + BOOTH.frontZ + 0.04) / 2];
const interiorB = [BOOTH.width / 2, BOOTH.height / 2, depthExt / 2];
// the bases move (they step back while a sample is on the tray), so the shell's AO leaves them out;
// their own faces still see the floor and walls, and their contact on the floor is the contact
// shadow that travels with them
const bases = LINEUP.map((slug) => {
  const st = STAGING[slug];
  return { c: [st.x, st.base.h / 2, st.z], b: [st.base.w / 2, st.base.h / 2, st.base.d / 2], r: 0.002 };
});
const solids = [];
solids.push({ c: [0, LIP.h / 2, BOOTH.frontZ - LIP.d / 2 - 0.002], b: [BOOTH.width / 2 - COVE, LIP.h / 2, LIP.d / 2], r: 0.004 });
const L = PROPS.ledge;
solids.push({ c: [L.x, L.y + L.h / 2, BOOTH.backZ + L.d / 2 + 0.0015], b: [L.w / 2, L.h / 2, L.d / 2], r: 0.002 });
// the hood as an oriented box
const hoodSlope = Math.atan2(HOOD.drop, HOOD.run);
const hoodQ = new Quaternion().setFromEuler(new Euler(-hoodSlope, 0, 0)).invert();
const hoodC = new Vector3(0, BOOTH.height - HOOD.drop / 2, BOOTH.frontZ - HOOD.run / 2 + 0.01);
const hoodB = [BOOTH.width / 2, 0.006, Math.hypot(HOOD.drop, HOOD.run) / 2];
const tmp = new Vector3();

function sdf(p, withBases, self) {
  // inside the coved interior box (positive inside), open to the front beyond the opening
  let d = p[2] > BOOTH.frontZ ? 1 : -sdRoundBox([p[0] - interiorC[0], p[1] - interiorC[1], p[2] - interiorC[2]], interiorB, COVE);
  for (const s of solids) d = Math.min(d, sdRoundBox([p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]], s.b, s.r));
  for (const s of bases) if (withBases && s !== self) d = Math.min(d, sdRoundBox([p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]], s.b, s.r));
  tmp.set(p[0], p[1], p[2]).sub(hoodC).applyQuaternion(hoodQ);
  d = Math.min(d, sdRoundBox([tmp.x, tmp.y, tmp.z], hoodB, 0.003));
  return d;
}

/** SDF ambient occlusion: march out along the normal, comparing distance travelled with free space. */
const STEPS = [0.008, 0.02, 0.04, 0.07, 0.11, 0.16];
function ao(p, n, self) {
  let occ = 0, w = 1;
  for (const h of STEPS) {
    const q = [p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h];
    // a base sees the shell but not itself (its own faces are flat): leave its own box out
    occ += Math.max(0, h - sdf(q, false, self)) * w;
    w *= 0.62;
  }
  return Math.min(1, Math.max(0.35, 1 - 5.2 * occ));
}

// ── rasterise every triangle into the uv1 atlas ─────────────────────────────────────────────
const N = ATLAS.size;
const img = new Float32Array(N * N).fill(-1);
const q = new Quaternion(), e = new Euler();
for (const part of parts) {
  if (part.role === 'housing' || part.role === 'frame' || part.role === 'diffuser') continue; // dark or emissive: no AO needed
  const g = part.geometry;
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv1 = g.getAttribute('uv1');
  q.setFromEuler(e.set(...(part.rotation ?? [0, 0, 0])));
  const flip = part.role === 'interior' ? -1 : 1; // the interior is seen from inside
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
        P.applyQuaternion(q).add(tmp.set(...part.position));
        Nn.applyQuaternion(q).normalize().multiplyScalar(flip);
        // start just off the surface so the surface itself is not counted
        const p = [P.x + Nn.x * 0.0015, P.y + Nn.y * 0.0015, P.z + Nn.z * 0.0015];
        const v = ao(p, [Nn.x, Nn.y, Nn.z], null);
        const i = y * N + x;
        img[i] = img[i] < 0 ? v : Math.min(img[i], v);
      }
  }
}
// dilate into the padding so bilinear filtering never pulls in empty texels
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
        if (v >= 0) {
          s += v;
          n++;
        }
      }
      if (n) img[i] = s / n;
    }
}
const bytes = Buffer.alloc(N * N);
let lo = 1, sum = 0, cnt = 0;
for (let i = 0; i < img.length; i++) {
  const v = img[i] < 0 ? 1 : img[i];
  bytes[i] = Math.round(v * 255);
  if (img[i] >= 0) {
    lo = Math.min(lo, v);
    sum += v;
    cnt++;
  }
}
mkdirSync(join(ROOT, 'public/booth'), { recursive: true });
await sharp(bytes, { raw: { width: N, height: N, channels: 1 } }).png({ compressionLevel: 9 }).toFile(join(ROOT, 'public/booth/ao.png'));
console.log(`ao.png: ${N}², ${cnt} texels baked, min ${lo.toFixed(2)}, mean ${(sum / cnt).toFixed(3)}`);

// ── booth-room.glb for the Blender lightmap bake (J1) ───────────────────────────────────────
// The room only: interior, frame, housing, hood, diffuser and lip. The plinths, the riser and the
// shelf move or carry props, so they keep their own AO in code (public/booth/ao.png), not the bake.
const ROOM = new Set(['interior', 'frame', 'housing', 'hood', 'diffuser', 'lip']);
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('booth-room');
const mats = {};
const mat = (role) => (mats[role] ??= doc.createMaterial(role).setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(role === 'interior'));
for (const part of parts.filter((p) => ROOM.has(p.role))) {
  const g = part.geometry.index ? part.geometry : part.geometry;
  const acc = (name, attr, type) => doc.createAccessor(`${part.name}-${name}`).setType(type).setArray(new Float32Array(attr.array)).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc('pos', g.getAttribute('position'), 'VEC3'))
    .setAttribute('NORMAL', acc('nor', g.getAttribute('normal'), 'VEC3'))
    .setAttribute('TEXCOORD_0', acc('uv0', g.getAttribute('uv'), 'VEC2'))
    .setAttribute('TEXCOORD_1', acc('uv1', g.getAttribute('uv1'), 'VEC2'))
    .setMaterial(mat(part.role));
  if (g.index) prim.setIndices(doc.createAccessor(`${part.name}-idx`).setType('SCALAR').setArray(new Uint32Array(g.index.array)).setBuffer(buffer));
  const mesh = doc.createMesh(part.name).addPrimitive(prim);
  q.setFromEuler(e.set(...(part.rotation ?? [0, 0, 0])));
  scene.addChild(doc.createNode(part.name).setMesh(mesh).setTranslation(part.position).setRotation([q.x, q.y, q.z, q.w]).setExtras({ role: part.role, slug: part.slug ?? null }));
}
const io = new NodeIO();
// A (08): the room is FROZEN for the lightmap bake. tools/booth-room.lock holds its hash; a change is
// refused unless ROOM_UNFREEZE=1 (and then the lightmap must be re-baked).
{
  const { createHash } = await import('crypto');
  const bytes = await io.writeBinary(doc);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const lock = join(ROOT, 'tools/booth-room.lock');
  const { existsSync, readFileSync } = await import('fs');
  const locked = existsSync(lock) ? readFileSync(lock, 'utf8').trim() : null;
  if (locked && locked !== hash && process.env.ROOM_UNFREEZE !== '1') {
    console.error(`booth-room.glb would change (${hash.slice(0, 12)} ≠ frozen ${locked.slice(0, 12)}): the room is frozen. Set ROOM_UNFREEZE=1 only if the lightmap will be re-baked.`);
    process.exit(1);
  }
  if (!locked || process.env.ROOM_UNFREEZE === '1') writeFileSync(lock, hash + '\n');
}
await io.write(join(ROOT, 'tools/booth-room.glb'), doc);
console.log(`booth-room.glb: ${parts.filter((p) => ROOM.has(p.role)).length} parts`);

// ── camera.json for Blender ─────────────────────────────────────────────────────────────────
const b3 = (p) => [+p[0].toFixed(5), +(-p[2]).toFixed(5), +p[1].toFixed(5)]; // three (x, y, z) → Blender (x, -z, y)
const shotOut = (s, w, h) => ({
  three: { position: s.position.map((n) => +n.toFixed(5)), target: s.target.map((n) => +n.toFixed(5)) },
  blender: {
    location: b3(s.position),
    target: b3(s.target),
    // the site's lens shift (view offset, px) as Blender's shift (fraction of the larger dimension)
    shift_x: s.offset ? +(s.offset[0] / Math.max(w, h)).toFixed(5) : 0,
    shift_y: s.offset ? +(-s.offset[1] / Math.max(w, h)).toFixed(5) : 0,
  },
});
const homeBox = (w, h) => ({ left: w * 0.03, top: h * 0.3, width: w * 0.8, height: h * 0.7 });
const camera = {
  _readme:
    'Booth camera + staging for Blender. Units: metres. "three" = three.js world (Y-up, +Z towards camera); "blender" = the same point Z-up: (x, y, z)three -> (x, -z, y)blender. tools/blender_camera.py imports tools/booth-room.glb (the room only, TEXCOORD_1 lightmap atlas; plinths, riser and shelf carry their own AO in code) and builds the cameras from this file.',
  units: 'metres',
  lens: {
    fovVerticalDeg: FOV,
    sensorFit: 'VERTICAL',
    sensorHeightMm: SENSOR_HEIGHT_MM,
    focalLengthMm: +FOCAL_MM.toFixed(3),
    clipStart: 0.05,
    clipEnd: 12,
    eye: EYE,
    note: 'A ~38mm full-frame equivalent, 7 degrees down from a little above the plinth line. Home shots use a lens shift to place the cabinet in the page layout.',
  },
  shots: {
    'LINEUP_16x9 (1920x1080)': shotOut(cabinetShot({ width: 1920, height: 1080 }, homeBox(1920, 1080)), 1920, 1080),
    'LINEUP_16x10 (1440x900)': shotOut(cabinetShot({ width: 1440, height: 900 }, homeBox(1440, 900)), 1440, 900),
    TRAY_16x9: Object.fromEntries(LINEUP.map((s) => [s, shotOut(trayShot(s, 1920 / 1080), 1920, 1080)])),
  },
  booth: { ...BOOTH, faceZ: FACE_Z, cabinetFace: CABINET_FACE, cove: COVE },
  tray: { ...TRAY, blender: { center: b3([0, TRAY.top, TRAY.z]) } },
  bases: LINEUP.map((slug) => {
    const st = STAGING[slug];
    return { slug, kind: st.base.kind, size: st.base, scale: st.scale ?? 1, blender: { center: b3([st.x, st.base.h / 2, st.z]), objectBase: b3([st.x, st.base.h, st.z]) } };
  }),
  props: PROPS,
  roomGlb: 'booth-room.glb',
  lightmap: { uv: 'TEXCOORD_1', atlas: `${ATLAS.size}px`, output: 'public/booth/lightmap.exr (linear half float) or lightmap.png (16-bit linear); converted to public/booth/lightmap.ktx2' },
};
writeFileSync(join(ROOT, 'tools/camera.json'), JSON.stringify(camera, null, 2) + '\n');
console.log('camera.json written');
