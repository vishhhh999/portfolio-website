/**
 * The booth's static geometry, built once and shared by the site and the build tools
 * (tools/bake-booth.mjs bakes AO from it and exports tools/booth-shell.glb for the Blender
 * lightmap bake). Nothing here touches the DOM.
 *
 * Every mesh carries a second UV set (`uv1`, glTF TEXCOORD_1): one non-overlapping atlas for the
 * whole shell, so a baked AO map and, later, a Blender lightmap line up with the geometry exactly.
 * Each box face (a geometry group) gets its own rectangle in the atlas, sized by its area.
 */
import { BufferAttribute, PlaneGeometry, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOOTH, CABINET, CABINET_FACE, COVE, DIFFUSER, HOOD, LIP, PLINTH_CHAMFER, PROPS, STAGING, type Staging } from './staging.ts';

export type ShellPart = {
  name: string;
  geometry: BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** What it is, for materials: interior surfaces are seen from inside (BackSide). */
  role: 'interior' | 'frame' | 'housing' | 'hood' | 'diffuser' | 'lip' | 'shelf' | 'base';
  /** For bases: the lineup slug standing on it. */
  slug?: string;
};

/** Atlas resolution the AO bake writes, and its scale in texels per metre. */
export const ATLAS = { size: 1024, pxPerMetre: 260, pad: 4 } as const;

const depthExt = BOOTH.frontZ - BOOTH.backZ + 0.04; // the interior box runs 4cm into the frame
const cz = (BOOTH.backZ + BOOTH.frontZ + 0.04) / 2;

/** A box with every edge rounded (radius r, `seg` segments: 1 = a chamfer). Groups: +x −x +y −y +z −z. */
const rbox = (w: number, h: number, d: number, seg: number, r: number) => new RoundedBoxGeometry(w, h, d, seg, r);

export function shellParts(lineupSlugs: string[]): ShellPart[] {
  const { width: W, height: H, backZ, frontZ } = BOOTH;
  const parts: ShellPart[] = [];

  // interior: one box with 20mm coves in every inside corner, seen from inside
  parts.push({ name: 'interior', role: 'interior', geometry: rbox(W, H, depthExt, 4, COVE), position: [0, H / 2, cz] });

  // the hood: a sloped valance under the top of the opening, hiding the tubes
  const slope = Math.atan2(HOOD.drop, HOOD.run);
  const len = Math.hypot(HOOD.drop, HOOD.run);
  parts.push({
    name: 'hood',
    role: 'hood',
    geometry: rbox(W - 0.004, 0.012, len, 2, 0.003),
    position: [0, H - HOOD.drop / 2, frontZ - HOOD.run / 2 + 0.01],
    rotation: [-slope, 0, 0],
  });

  // the opal diffuser, recessed a hair below the ceiling
  const dif = new PlaneGeometry(DIFFUSER.w, DIFFUSER.d);
  parts.push({ name: 'diffuser', role: 'diffuser', geometry: dif, position: [0, H - 0.004, DIFFUSER.z], rotation: [Math.PI / 2, 0, 0] });

  // the front frame: satin black anodised, every edge chamfered (one-segment bevel)
  const fz = frontZ + CABINET.proud / 2;
  const ch = CABINET.chamfer;
  // The opening is 2mm smaller than the interior on every side: the frame overlaps the walls,
  // floor and ceiling, so its inner faces are never coplanar with them (no z-fighting at the joint).
  parts.push({ name: 'frame-hood', role: 'frame', geometry: rbox(CABINET_FACE.w, CABINET.header + 0.002, CABINET.proud, 1, ch), position: [0, H + CABINET.header / 2 - 0.001, fz] });
  for (const s of [-1, 1])
    parts.push({
      name: s < 0 ? 'frame-post-left' : 'frame-post-right',
      role: 'frame',
      geometry: rbox(CABINET.post + 0.002, H, CABINET.proud, 1, ch),
      position: [s * (W / 2 + CABINET.post / 2 - 0.001), H / 2, fz],
    });
  parts.push({ name: 'frame-sill', role: 'frame', geometry: rbox(CABINET_FACE.w, CABINET.sill + 0.002, CABINET.proud, 1, ch), position: [0, -CABINET.sill / 2 + 0.001, fz] });
  // the base plinth: 15mm in from each side and set back 3mm, so the frame's face is the silhouette
  parts.push({ name: 'frame-base', role: 'frame', geometry: rbox(CABINET_FACE.w - 0.03, CABINET.base, CABINET.proud, 1, ch), position: [0, -CABINET.sill - CABINET.base / 2, fz - 0.003] });

  // the housing behind the frame: 1mm inside the frame's outline on every side (never coplanar with
  // it, never showing past it), and clear of the interior box by 2mm
  const hd = depthExt;
  const hw = CABINET_FACE.w - 0.002;
  parts.push({ name: 'housing-top', role: 'housing', geometry: rbox(hw, CABINET.header - 0.003, hd, 1, ch), position: [0, H + 0.002 + (CABINET.header - 0.003) / 2, cz] });
  for (const s of [-1, 1])
    parts.push({ name: s < 0 ? 'housing-left' : 'housing-right', role: 'housing', geometry: rbox(CABINET.post - 0.003, H, hd, 1, ch), position: [s * (W / 2 + 0.002 + (CABINET.post - 0.003) / 2), H / 2, cz] });
  parts.push({ name: 'housing-bottom', role: 'housing', geometry: rbox(hw, CABINET.sill + CABINET.base - 0.003, hd, 1, ch), position: [0, -0.002 - (CABINET.sill + CABINET.base - 0.003) / 2, cz] });

  // the lip at the front edge of the floor
  parts.push({ name: 'lip', role: 'lip', geometry: rbox(W - 2 * COVE, LIP.h, LIP.d, 2, 0.004), position: [0, LIP.h / 2, frontZ - LIP.d / 2 - 0.002] });

  // the calibration shelf on the back wall (1.5mm off the wall)
  const L = PROPS.ledge;
  parts.push({ name: 'shelf', role: 'shelf', geometry: rbox(L.w, L.h, L.d, 2, 0.002), position: [L.x, L.y + L.h / 2, backZ + L.d / 2 + 0.0015] });

  // the bases: plinths, the acrylic riser, the shallow tray (positions are the slot origins)
  for (const slug of lineupSlugs) {
    const st = STAGING[slug];
    parts.push({ name: `base-${slug}`, role: 'base', slug, geometry: baseGeometry(st), position: [st.x, st.base.h / 2, st.z] });
  }

  addAtlasUv(parts);
  // the interior's open front (group 4) must not exist at all: override-material passes (normals
  // for SSAO, depth) ignore per-group visibility. Collapse its triangles to nothing.
  const interior = parts[0].geometry;
  const front = interior.groups[4];
  const idx = interior.index;
  const pos = interior.getAttribute('position');
  if (idx) {
    for (let i = front.start; i < front.start + front.count; i++) idx.setX(i, idx.getX(front.start));
    idx.needsUpdate = true;
  } else {
    // non-indexed: every vertex of the group onto one point (zero-area triangles are never drawn)
    for (let i = front.start; i < front.start + front.count; i++) pos.setXYZ(i, pos.getX(front.start), pos.getY(front.start), pos.getZ(front.start));
    pos.needsUpdate = true;
  }
  return parts;
}

/** A sample's base: plinths and the riser chamfered 2mm, the shallow tray a little softer. */
export function baseGeometry(st: Staging) {
  const b = st.base;
  return b.kind === 'tray' ? rbox(b.w, b.h, b.d, 2, 0.004) : rbox(b.w, b.h, b.d, 3, PLINTH_CHAMFER);
}

/** Atlas rectangles for every group of every part (simple shelf packing, tallest first). */
function addAtlasUv(parts: ShellPart[]) {
  type Rect = { part: ShellPart; group: number; w: number; h: number; x: number; y: number };
  const rects: Rect[] = [];
  for (const part of parts) {
    const g = part.geometry;
    const pos = g.getAttribute('position');
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : pos.count, materialIndex: 0 }];
    groups.forEach((grp, gi) => {
      // face size from the group's own extent along its two in-plane axes
      const idx = g.index;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        const vi = idx ? idx.getX(i) : i;
        const p = [pos.getX(vi), pos.getY(vi), pos.getZ(vi)];
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], p[k]);
          max[k] = Math.max(max[k], p[k]);
        }
      }
      // a box face's uv runs along known axes (BoxGeometry order +x −x +y −y +z −z); a plane's along x, y
      const [ua, va] = g.groups.length ? ([[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]][gi] as [number, number]) : [0, 1];
      const ext = [max[ua] - min[ua], max[va] - min[va]];
      // texel density by what is seen: the interior and the bases in full, the frame less, the housing
      // (only its edges show) and the interior's open front (never drawn) almost nothing
      const hidden = (part.role === 'interior' && gi === 4) || part.role === 'housing';
      const density = hidden ? 12 : part.role === 'frame' || part.role === 'hood' ? ATLAS.pxPerMetre * 0.6 : ATLAS.pxPerMetre;
      const px = (m: number) => Math.max(6, Math.ceil(m * density));
      rects.push({ part, group: gi, w: px(ext[0]), h: px(ext[1]), x: 0, y: 0 });
    });
  }
  // shelf packing. A (08): the room (frozen for the lightmap bake) packs first, on its own, so its
  // UV1 never moves when the bases, risers or shelf change; everything else packs after it
  const ROOM = new Set(['interior', 'frame', 'housing', 'hood', 'diffuser', 'lip']);
  const byHeight = (a: Rect, b: Rect) => b.h - a.h;
  const order = [...rects.filter((r) => ROOM.has(r.part.role)).sort(byHeight), null, ...rects.filter((r) => !ROOM.has(r.part.role)).sort(byHeight)];
  let x = ATLAS.pad, y = ATLAS.pad, rowH = 0;
  for (const r of order) {
    if (r === null) {
      // a fresh row for the movable parts
      x = ATLAS.pad;
      y += rowH + ATLAS.pad;
      rowH = 0;
      continue;
    }
    if (x + r.w + ATLAS.pad > ATLAS.size) {
      x = ATLAS.pad;
      y += rowH + ATLAS.pad;
      rowH = 0;
    }
    r.x = x;
    r.y = y;
    x += r.w + ATLAS.pad;
    rowH = Math.max(rowH, r.h);
  }
  const used = y + rowH + ATLAS.pad;
  if (used > ATLAS.size) throw new Error(`shell atlas overflow: ${used}px > ${ATLAS.size}px; lower ATLAS.pxPerMetre`);
  // write uv1 from each vertex's own face uv into its rectangle
  for (const part of parts) {
    const g = part.geometry;
    const uv = g.getAttribute('uv');
    const uv1 = new Float32Array(uv.count * 2);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : uv.count, materialIndex: 0 }];
    groups.forEach((grp, gi) => {
      const r = rects.find((q) => q.part === part && q.group === gi)!;
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        const vi = g.index ? g.index.getX(i) : i;
        const u = uv.getX(vi), v = uv.getY(vi);
        uv1[vi * 2] = (r.x + u * r.w) / ATLAS.size;
        uv1[vi * 2 + 1] = 1 - (r.y + (1 - v) * r.h) / ATLAS.size;
      }
    });
    g.setAttribute('uv1', new BufferAttribute(uv1, 2));
  }
}
