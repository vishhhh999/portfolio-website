/**
 * B1 (09): depth-flicker guard. Every booth mesh at its staged transform (the nine desktop GLBs on
 * their bases, the SHUNYA layout, the frozen room). Flags any two surfaces closer than 0.5mm that
 * face the same way within 5 degrees (the side that is actually drawn: a BackSide material's visible
 * normal is flipped) and overlap in projection by more than 0.05mm²: the geometry that z-fights.
 *
 * A pair counts only where a camera can see it: from the booth camera, and from eight turntable
 * angles around the object both in the booth and on the tray (each sample can be turned all the way
 * round), a ray must reach the pair's shared area before anything else that is drawn. Surfaces sealed
 * inside a closed solid (a tray panel under its sleeve, a tin's inner wall) cannot flicker and are
 * listed as hidden, not failed. Must report zero visible pairs.
 *
 *   node --experimental-strip-types tools/check-coplanar.mjs
 *   OVERRIDE=house-of-hex=/tmp/old.glb ...   (prove it catches a file: the 08 House of Hex fails)
 *   ONLY=house-of-hex,sonde ...              (just these objects, no room)
 *   HIDDEN=1 ...                             (also list the hidden pairs)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, Euler, Float32BufferAttribute, FrontSide, Matrix4, Quaternion, Ray, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { DESKTOP_STAGING } from '../components/booth/staging.ts';
import { cabinetShot, trayShot } from '../components/booth/shots.ts';

const ROOT = new URL('../', import.meta.url).pathname;
const GAP = 0.0005; // 0.5mm
const COS = Math.cos((5 * Math.PI) / 180);
const MIN_AREA = 5e-8; // 0.05 mm² of shared area (m²)
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/** Per-object model config that moves geometry (content/work/*.ts), mirrored here. */
const MODEL = {
  'bengal-t20': { rotation: [0.8, 0, 0], plinthOffset: 0.0727 },
  'indo-thai': { rotation: [0, -0.95, 0] },
  mitooshi: { center: true },
};
/** How the room's parts are drawn (BoothRoom.tsx): override with ROOM_SIDES='{"interior":"front"}'. */
const ROOM_SIDES = { interior: 'front', hood: 'double', ...JSON.parse(process.env.ROOM_SIDES || '{}') };
/** Runtime side overrides per object (content/work: Too Yumm is FrontSide only; the rest as authored). */
const FRONT_ONLY = new Set(['too-yumm']);

/** SHUNYA's piece layout, read from content/work/shunya.ts (name: [x, z, yaw]). */
async function shunyaLayout() {
  const src = (await import('fs')).readFileSync(ROOT + 'content/work/shunya.ts', 'utf8');
  const out = {};
  for (const m of src.matchAll(/(shunya_\w+):\s*\[([^\]]+)\]/g)) out[m[1]] = m[2].split(',').map(Number);
  return out;
}

const overrides = Object.fromEntries((process.env.OVERRIDE || '').split(',').filter(Boolean).map((s) => s.split('=')));
const only = (process.env.ONLY || '').split(',').filter(Boolean);

/** Triangles of a GLB: [{group, mesh, a, b, c, n (drawn side), double, area}], in model space then placed. */
async function trianglesOf(file, group, { place = new Matrix4(), layout = null, center = false, frontOnly = false, sides = {} } = {}) {
  const doc = await io.read(file);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const world = (node) => new Matrix4().fromArray(node.getWorldMatrix());
  const nodeBox = (node) => {
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
    const m = world(node), v = new Vector3();
    for (const p of node.getMesh()?.listPrimitives() ?? []) {
      const pos = p.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) (v.fromArray(pos.getElement(i, [])).applyMatrix4(m), lo.min(v), hi.max(v));
    }
    return { lo, hi };
  };
  // a layout moves named pieces so their footprint centre lands on [x, z], turned by yaw (ObjectSlot)
  if (layout) {
    for (const [name, [lx, lz, yaw]] of Object.entries(layout)) {
      const node = doc.getRoot().listNodes().find((n) => n.getName() === name);
      if (!node) continue;
      node.setRotation(new Quaternion().fromArray(node.getRotation()).premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)).toArray());
      const { lo, hi } = nodeBox(node);
      const t = node.getTranslation();
      node.setTranslation([t[0] + lx - (lo.x + hi.x) / 2, t[1], t[2] + lz - (lo.z + hi.z) / 2]);
    }
  }
  const raw = [];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = world(node);
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const name = node.getName() || mesh.getName();
      const side = sides[name] ?? (p.getMaterial()?.getDoubleSided() && !frontOnly ? 'double' : 'front');
      for (let i = 0; i + 2 < n; i += 3) {
        const V = (k) => new Vector3().fromArray(pos.getElement(idx ? idx.getScalar(i + k) : i + k, [])).applyMatrix4(m);
        raw.push({ mesh: `${group}/${name}`, mat: p.getMaterial()?.getName() ?? '', side, a: V(0), b: V(1), c: V(2) });
      }
    }
  });
  // ObjectSlot centres a model's footprint when its config says so (Mitooshi: the open lid reaches back)
  const shift = new Vector3();
  if (center) {
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
    for (const t of raw) for (const v of [t.a, t.b, t.c]) (lo.min(v), hi.max(v));
    shift.set(-(lo.x + hi.x) / 2, 0, -(lo.z + hi.z) / 2);
  }
  const tris = [];
  for (const t of raw) {
    for (const k of ['a', 'b', 'c']) t[k].add(shift).applyMatrix4(place);
    const nrm = new Vector3().subVectors(t.b, t.a).cross(new Vector3().subVectors(t.c, t.a));
    const area = nrm.length() / 2;
    if (area < 1e-10) continue;
    nrm.normalize();
    // the drawn side: a BackSide surface is seen from behind its winding
    if (t.side === 'back') {
      nrm.negate();
      [t.b, t.c] = [t.c, t.b];
    }
    tris.push({ group, mesh: t.mesh, mat: t.mat, a: t.a, b: t.b, c: t.c, n: nrm, double: t.side === 'double', area });
  }
  return tris;
}

/** Overlap polygon (2D, in t's plane frame) of two nearly coplanar triangles: its area and 3D centroid. */
function overlap(t, u) {
  const n = t.n;
  const ax = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const e1 = ax.sub(n.clone().multiplyScalar(ax.dot(n))).normalize();
  const e2 = n.clone().cross(e1);
  const to2 = (p) => [p.dot(e1), p.dot(e2)];
  let poly = [to2(u.a), to2(u.b), to2(u.c)];
  const clip = [to2(t.a), to2(t.b), to2(t.c)];
  const sgn = (clip[1][0] - clip[0][0]) * (clip[2][1] - clip[0][1]) - (clip[1][1] - clip[0][1]) * (clip[2][0] - clip[0][0]);
  if (sgn < 0) clip.reverse();
  for (let i = 0; i < 3 && poly.length; i++) {
    const [p, q] = [clip[i], clip[(i + 1) % 3]];
    const inside = (s) => (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]) >= 0;
    const cross = (s, e) => {
      const a1 = q[1] - p[1], b1 = p[0] - q[0], c1 = a1 * p[0] + b1 * p[1];
      const a2 = e[1] - s[1], b2 = s[0] - e[0], c2 = a2 * s[0] + b2 * s[1];
      const det = a1 * b2 - a2 * b1;
      return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const out = [];
    for (let j = 0; j < poly.length; j++) {
      const s = poly[j], e = poly[(j + 1) % poly.length];
      if (inside(e)) {
        if (!inside(s)) out.push(cross(s, e));
        out.push(e);
      } else if (inside(s)) out.push(cross(s, e));
    }
    poly = out;
  }
  let A = 0, cx = 0, cy = 0;
  for (let j = 0; j < poly.length; j++) {
    const [x0, y0] = poly[j], [x1, y1] = poly[(j + 1) % poly.length];
    const cr = x0 * y1 - x1 * y0;
    A += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  }
  if (Math.abs(A) < 1e-14) return { area: 0 };
  cx /= 3 * A;
  cy /= 3 * A;
  const d = t.a.dot(n);
  return { area: Math.abs(A) / 2, at: e1.multiplyScalar(cx).add(e2.multiplyScalar(cy)).add(n.clone().multiplyScalar(d)) };
}

// ── gather ────────────────────────────────────────────────────────────────────────────────────
const all = [];
const groups = {};
const layout = await shunyaLayout();
for (const [slug, st] of Object.entries(DESKTOP_STAGING)) {
  if (only.length && !only.includes(slug)) continue;
  const file = overrides[slug] || `${ROOT}public/models/${slug}/${slug}.glb`;
  const cfg = MODEL[slug] ?? {};
  const s = st.scale ?? 1;
  const place = new Matrix4()
    .makeTranslation(st.x, st.base.h, st.z)
    .multiply(new Matrix4().makeScale(s, s, s))
    .multiply(new Matrix4().compose(new Vector3(0, cfg.plinthOffset ?? 0, 0), new Quaternion().setFromEuler(new Euler(...(cfg.rotation ?? [0, 0, 0]))), new Vector3(1, 1, 1)));
  const tris = await trianglesOf(file, slug, { place, layout: slug === 'shunya' ? layout : null, center: !!cfg.center, frontOnly: FRONT_ONLY.has(slug) });
  groups[slug] = { tris, centre: new Vector3(st.x, st.base.h + st.object.h / 2, st.z) };
  all.push(...tris);
  console.log(`${slug}: ${tris.length} triangles${overrides[slug] ? ` (from ${overrides[slug]})` : ''}`);
}
if (!only.length) {
  const tris = await trianglesOf(`${ROOT}tools/booth-room.glb`, 'room', { sides: ROOM_SIDES });
  groups.room = { tris };
  all.push(...tris);
  console.log(`room: ${tris.length} triangles`);
}

// ── candidate pairs: spatial hash on triangle boxes (1cm cells), each pair tested in one cell ──
const CELL = 0.01;
const grid = new Map();
all.forEach((t, ti) => {
  t.i = ti;
  t.lo = [0, 1, 2].map((d) => Math.floor((Math.min(t.a.getComponent(d), t.b.getComponent(d), t.c.getComponent(d)) - GAP) / CELL));
  t.hi = [0, 1, 2].map((d) => Math.floor((Math.max(t.a.getComponent(d), t.b.getComponent(d), t.c.getComponent(d)) + GAP) / CELL));
  if ((t.hi[0] - t.lo[0] + 1) * (t.hi[1] - t.lo[1] + 1) * (t.hi[2] - t.lo[2] + 1) > 4000) return (t.big = true);
  for (let i = t.lo[0]; i <= t.hi[0]; i++) for (let j = t.lo[1]; j <= t.hi[1]; j++) for (let k = t.lo[2]; k <= t.hi[2]; k++) {
    const kk = `${i},${j},${k}`;
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(ti);
  }
});
const found = [];
const dPlane = (p, q) => Math.abs(new Vector3().subVectors(p, q.a).dot(q.n));
const test = (i, j, cell) => {
  if (i === j) return;
  const t = all[i], u = all[j];
  const dot = t.n.dot(u.n);
  if ((t.double || u.double ? Math.abs(dot) : dot) < COS) return;
  if (cell && (cell[0] !== Math.max(t.lo[0], u.lo[0]) || cell[1] !== Math.max(t.lo[1], u.lo[1]) || cell[2] !== Math.max(t.lo[2], u.lo[2]))) return;
  const gap = Math.min(Math.max(dPlane(u.a, t), dPlane(u.b, t), dPlane(u.c, t)), Math.max(dPlane(t.a, u), dPlane(t.b, u), dPlane(t.c, u)));
  if (gap > GAP) return;
  const ov = overlap(t, u);
  if (ov.area < MIN_AREA) return;
  found.push({ t, u, gap, area: ov.area, at: ov.at });
};
for (const [kk, list] of grid) {
  const cell = kk.split(',').map(Number);
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) test(list[a], list[b], cell);
}
const bigs = all.filter((t) => t.big).map((t) => t.i);
for (let x = 0; x < bigs.length; x++) for (let j = 0; j < all.length; j++) if (!all[j].big || bigs.indexOf(j) > x) test(bigs[x], j, null);

// ── visibility: can any camera see the shared area? ──────────────────────────────────────────
// a BVH per group of the faces as drawn (front-facing winding; double-sided faces both ways)
const bvh = {};
for (const [g, { tris }] of Object.entries(groups)) {
  const pos = [];
  for (const t of tris) {
    pos.push(...t.a.toArray(), ...t.b.toArray(), ...t.c.toArray());
    if (t.double) pos.push(...t.a.toArray(), ...t.c.toArray(), ...t.b.toArray());
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  bvh[g] = new MeshBVH(geo);
}
const cabinet = (() => {
  const W = 1568, H = 980, top = 290, aspect = 1.707, bw = Math.min(W - 64, aspect * (H - top - 102));
  return new Vector3(...cabinetShot({ width: W, height: H }, { left: (W - bw) / 2, top, width: bw, height: bw / aspect }).position);
})();
/** Cameras for a group: the booth camera (with parallax); for a sample, eight turntable angles in the booth and on the tray. */
const camCache = {};
function camerasFor(g) {
  if (camCache[g]) return camCache[g];
  const list = [cabinet, cabinet.clone().add(new Vector3(0.05, 0.02, 0)), cabinet.clone().add(new Vector3(-0.05, -0.02, 0))];
  if (g !== 'room') {
    const { centre } = groups[g];
    const tray = trayShot(g, 2.2);
    const trayRel = new Vector3(...tray.position).sub(new Vector3(...tray.target));
    const cabRel = cabinet.clone().sub(centre);
    for (let k = 0; k < 8; k++) {
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (k * Math.PI) / 4);
      list.push(centre.clone().add(cabRel.clone().applyQuaternion(q)));
      list.push(centre.clone().add(trayRel.clone().applyQuaternion(q)));
    }
  }
  return (camCache[g] = list);
}
const ray = new Ray();
function visible(f) {
  const gs = [...new Set([f.t.group, f.u.group])];
  for (const g of gs) {
    for (const cam of camerasFor(g)) {
      const to = f.at.clone().sub(cam);
      const dist = to.length();
      ray.set(cam, to.normalize());
      // the faces must be drawn toward this camera, and not edge-on (a surface seen within ~6° of edge-on
      // covers no pixels worth fighting over)
      const facing = f.t.n.dot(ray.direction);
      if (f.t.double ? Math.abs(facing) < 0.1 : facing > -0.1) continue;
      let first = Infinity;
      for (const h of gs) {
        const hit = bvh[h].raycastFirst(ray, FrontSide);
        if (hit) first = Math.min(first, hit.distance);
      }
      if (first >= dist - 0.0006) {
        if (process.env.WHY && f.t.mesh.includes(process.env.WHY)) console.log('WHY', f.t.mesh, f.u.mesh, 'n', f.t.n.toArray().map((v) => +v.toFixed(3)), 'at', f.at.toArray().map((v) => +v.toFixed(4)), 'cam', cam.toArray().map((v) => +v.toFixed(3)), 'dist', dist.toFixed(4), 'first', first.toFixed(4));
        return true;
      }
    }
  }
  return false;
}

const report = (list) => {
  const m = new Map();
  for (const f of list) {
    const k = [f.t.mesh + (f.t.mat ? ` (${f.t.mat})` : ''), f.u.mesh + (f.u.mat ? ` (${f.u.mat})` : '')].sort().join(' ~ ');
    const e = m.get(k) ?? { count: 0, area: 0, gap: Infinity };
    e.count++;
    e.area += f.area;
    e.gap = Math.min(e.gap, f.gap);
    m.set(k, e);
  }
  return [...m].sort((a, b) => b[1].area - a[1].area);
};
const visibleAll = found.filter(visible);
const hidden = found.filter((f) => !visibleAll.includes(f));
// two separate parts (a screen and its glass, a decal and its lid) fail the check; overlaps authored
// inside one part (one node: a box's sleeve and tray panels, a tin and its rim) are listed for the
// Blender clean-up, since moving them apart needs the model itself
const seen = visibleAll.filter((f) => f.t.mesh !== f.u.mesh);
const within = visibleAll.filter((f) => f.t.mesh === f.u.mesh);
console.log(`${all.length} triangles; ${found.length} coplanar triangle pairs within 0.5mm, ${visibleAll.length} of them visible from a booth or tray camera, ${seen.length} between separate parts`);
if (process.env.HIDDEN && hidden.length) {
  console.log('hidden (sealed inside a solid, or behind another surface from every camera):');
  for (const [k, e] of report(hidden)) console.log(`  ${k}: ${e.count} pairs, ${(e.area * 1e6).toFixed(1)} mm², closest ${(e.gap * 1000).toFixed(3)} mm`);
}
if (within.length) {
  console.log('authored overlaps inside one part (visible; a Blender clean-up item, not a separate surface over another):');
  for (const [k, e] of report(within)) console.log(`  ${k}: ${e.count} pairs, ${(e.area * 1e6).toFixed(1)} mm², closest ${(e.gap * 1000).toFixed(3)} mm`);
}
if (!seen.length) {
  console.log('✓ no two separate parts within 0.5mm of each other, facing the same way, where a camera can see them');
  process.exit(0);
}
console.log(`✗ visible coplanar surfaces within 0.5mm (depth flicker):`);
for (const [k, e] of report(seen)) console.log(`  ${k}: ${e.count} triangle pairs, ${(e.area * 1e6).toFixed(1)} mm² overlap, closest ${(e.gap * 1000).toFixed(3)} mm`);
process.exit(1);
