/**
 * H3 (09): mesh-level clearance inside a sample group. Every multi-piece sample (the SHUNYA range,
 * laid out by content/work/shunya.ts) is placed exactly as ObjectSlot places it, and the closest
 * distance between each pair of pieces is measured on the real triangles (three-mesh-bvh). Two pieces
 * that intersect, or come closer than 2mm, fail. Imported by tools/check-sizes.mjs; runs alone too:
 *   node tools/mesh-clearance.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { readFileSync } from 'fs';

const ROOT = new URL('../', import.meta.url).pathname;
export const MIN_CLEARANCE = 0.002;

/** The groups to test: the GLB and the layout (node → [x, z, yaw]) read from content/work/<slug>.ts. */
function groups() {
  const out = [];
  for (const slug of ['shunya']) {
    const src = readFileSync(`${ROOT}content/work/${slug}.ts`, 'utf8');
    const layout = {};
    for (const m of src.matchAll(/(\w+):\s*\[([-0-9.,\s]+)\]/g)) layout[m[1]] = m[2].split(',').map(Number);
    out.push({ slug, file: `${ROOT}public/models/${slug}/${slug}.glb`, layout });
  }
  return out;
}

export async function meshClearance(log = console.log) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  let ok = true;
  const results = {};
  for (const g of groups()) {
    const doc = await io.read(g.file);
    const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
    const world = (n) => new Matrix4().fromArray(n.getWorldMatrix());
    const pieces = [];
    for (const n of nodes) {
      // positions in the node's world space, then the layout move (ObjectSlot: yaw added, footprint centre to [x, z])
      const pos = [];
      const m = world(n);
      for (const p of n.getMesh().listPrimitives()) {
        const a = p.getAttribute('POSITION'), idx = p.getIndices();
        const cnt = idx ? idx.getCount() : a.getCount();
        for (let i = 0; i < cnt; i++) pos.push(new Vector3().fromArray(a.getElement(idx ? idx.getScalar(i) : i, [])).applyMatrix4(m));
      }
      const L = g.layout[n.getName()];
      if (L) {
        const [lx, lz, yaw] = L;
        // the yaw turns the node about its own origin (node.rotation.y += yaw in ObjectSlot)
        const o = new Vector3().fromArray(n.getTranslation());
        const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
        for (const v of pos) v.sub(o).applyQuaternion(q).add(o);
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const v of pos) (x0 = Math.min(x0, v.x), x1 = Math.max(x1, v.x), z0 = Math.min(z0, v.z), z1 = Math.max(z1, v.z));
        const dx = lx - (x0 + x1) / 2, dz = lz - (z0 + z1) / 2;
        for (const v of pos) (v.x += dx, v.z += dz);
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos.flatMap((v) => v.toArray()), 3));
      geo.boundsTree = new MeshBVH(geo);
      pieces.push({ name: n.getName(), geo });
    }
    const id = new Matrix4();
    const pairs = [];
    for (let i = 0; i < pieces.length; i++)
      for (let j = i + 1; j < pieces.length; j++) {
        const A = pieces[i], B = pieces[j];
        const hit = A.geo.boundsTree.intersectsGeometry(B.geo, id);
        const t1 = { point: new Vector3() }, t2 = { point: new Vector3() };
        const d = hit ? 0 : A.geo.boundsTree.closestPointToGeometry(B.geo, id, t1, t2)?.distance ?? Infinity;
        pairs.push({ a: A.name, b: B.name, mm: +(d * 1000).toFixed(1), hit });
        if (hit || d < MIN_CLEARANCE) ok = false;
      }
    results[g.slug] = pairs;
    for (const p of pairs) log(`${p.hit || p.mm < MIN_CLEARANCE * 1000 ? '✗' : '✓'} ${g.slug}: ${p.a} / ${p.b} ${p.hit ? 'INTERSECT' : `${p.mm}mm clear`}`);
  }
  return { ok, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok } = await meshClearance();
  process.exit(ok ? 0 : 1);
}
