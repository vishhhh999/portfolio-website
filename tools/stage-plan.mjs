/**
 * E (08): offline staging check, no browser: the site's own STAGING and cabinetShot (Node's
 * TypeScript stripping) at a desktop layout. Per sample: projected width as % of the cabinet; the
 * worst projected-box overlap; the smallest clear 3D gap (certificate included). The same maths as
 * tools/check-sizes.mjs, for fast iteration; check-sizes stays the authority.
 *   node --experimental-strip-types tools/stage-plan.mjs [W H]
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { BOOTH, CABINET_FACE, FACE_Z, FOV, sizeFloor, DESKTOP_STAGING, DESKTOP_PROPS } from '../components/booth/staging.ts';
import { PHONE_STAGING, PHONE_PROPS } from '../components/booth/phoneStaging.ts';
// PHONE=1: the phone arrangement (G 08) in the 4:5 portrait box at 390x844; sizes as % of the box width
const PHONE = !!process.env.PHONE;
const STAGING = PHONE ? PHONE_STAGING : DESKTOP_STAGING;
const { ledge: LEDGE, certificate: CERTIFICATE } = PHONE ? PHONE_PROPS : DESKTOP_PROPS;
const PROPS = { ledge: LEDGE };
import { cabinetShot } from '../components/booth/shots.ts';
const W = +(process.argv[2] || (PHONE ? 390 : 1568)), H = +(process.argv[3] || (PHONE ? 844 : 980));
const aspect = CABINET_FACE.w / CABINET_FACE.h;
const top = PHONE ? 190 : 290, avail = H - top - 70 - 14 - 18;
const bw = PHONE ? W - 32 : Math.min(W - 64, aspect * avail), bh = PHONE ? (bw * 5) / 4 : bw / aspect;
const box = { left: (W - bw) / 2, top, width: bw, height: bh };
const shot = cabinetShot({ width: W, height: H }, box);
const cam = new PerspectiveCamera(FOV, W / H, 0.05, 20);
cam.position.set(...shot.position);
cam.lookAt(...shot.target);
cam.setViewOffset(W, H, shot.offset[0], shot.offset[1], W, H);
cam.updateProjectionMatrix();
cam.updateMatrixWorld();
const P = (x, y, z) => {
  const v = new Vector3(x, y, z).project(cam);
  return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
};
const cabA = P(-CABINET_FACE.w / 2, BOOTH.height / 2, FACE_Z), cabB = P(CABINET_FACE.w / 2, BOOTH.height / 2, FACE_Z);
const cab = PHONE ? bw : cabB[0] - cabA[0];
const floor = (k) => (PHONE ? 14 : sizeFloor(k));
const aabb = {}, boxes = {}, pct = {};
for (const [slug, st] of Object.entries(STAGING)) {
  const { w, h, d } = st.object;
  const y0 = st.base.h;
  aabb[slug] = [st.x - w / 2, y0, st.z - d / 2, st.x + w / 2, y0 + h, st.z + d / 2];
  const zf = st.z + d / 2, yc = y0 + h / 2;
  // E (08): the long side (width, or height for a portrait piece), as % of the cabinet width
  const pw = P(st.x + w / 2, yc, zf)[0] - P(st.x - w / 2, yc, zf)[0];
  const ph = P(st.x, y0, zf)[1] - P(st.x, y0 + h, zf)[1];
  pct[slug] = +((Math.max(pw, ph) / cab) * 100).toFixed(1);
}
{
  const c = CERTIFICATE, y0 = PROPS.ledge.y + PROPS.ledge.h, zc = BOOTH.backZ + 0.035;
  aabb.about = [c.x - c.w / 2 - 0.012, y0, zc - 0.03, c.x + c.w / 2 + 0.012, y0 + c.h + 0.024, zc + 0.01];
}
for (const [k, a] of Object.entries(aabb)) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const x of [a[0], a[3]]) for (const y of [a[1], a[4]]) for (const z of [a[2], a[5]]) {
    const [px, py] = P(x, y, z);
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  boxes[k] = { x0, y0, x1, y1 };
}
const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const ks = Object.keys(aabb);
const over = [], gaps = [];
for (let i = 0; i < ks.length; i++)
  for (let j = i + 1; j < ks.length; j++) {
    const A = boxes[ks[i]], B = boxes[ks[j]];
    const ov = area({ x0: Math.max(A.x0, B.x0), y0: Math.max(A.y0, B.y0), x1: Math.min(A.x1, B.x1), y1: Math.min(A.y1, B.y1) });
    over.push([+((ov / Math.min(area(A), area(B))) * 100).toFixed(1), ks[i], ks[j]]);
    const a = aabb[ks[i]], b = aabb[ks[j]];
    const g = Math.hypot(Math.max(0, a[0] - b[3], b[0] - a[3]), Math.max(0, a[1] - b[4], b[1] - a[4]), Math.max(0, a[2] - b[5], b[2] - a[5]));
    gaps.push([+(g * 100).toFixed(1), ks[i], ks[j]]);
  }
over.sort((a, b) => b[0] - a[0]);
gaps.sort((a, b) => a[0] - b[0]);
console.log(`${W}x${H}`, Object.entries(pct).map(([k, v]) => `${k} ${v}%${v < floor(k) ? ` < ${floor(k)}!` : floor(k) < 11 ? ' (raised: 9)' : ''}`).join('  '));
if (process.env.V) for (const [k, a] of Object.entries(aabb)) console.log(' ', k.padEnd(13), 'x', a[0].toFixed(3), a[3].toFixed(3), ' y', a[1].toFixed(3), a[4].toFixed(3), ' z', a[2].toFixed(3), a[5].toFixed(3), ' px', boxes[k].x0.toFixed(0), boxes[k].x1.toFixed(0), boxes[k].y0.toFixed(0), boxes[k].y1.toFixed(0));
console.log('overlaps >0:', over.filter((o) => o[0] > 0).slice(0, 6).map((o) => `${o[1]}/${o[2]} ${o[0]}%`).join('  ') || 'none');
console.log('gaps <10cm:', gaps.filter((g) => g[0] < 10).map((g) => `${g[1]}/${g[2]} ${g[0]}cm`).join('  ') || 'none');
// walls and ceiling: every object inside the interior (coves 2cm), below the ceiling
for (const [k, a] of Object.entries(aabb)) {
  const bad = a[0] < -BOOTH.width / 2 + 0.03 || a[3] > BOOTH.width / 2 - 0.03 || a[2] < BOOTH.backZ + (k === 'about' ? 0 : 0.01) || a[5] > BOOTH.frontZ - 0.05 || a[4] > BOOTH.height - 0.06;
  if (bad) console.log('OUTSIDE the interior:', k, a.map((v) => v.toFixed(3)).join(','));
  const r = boxes[k];
  if (r.x0 < box.left + 4 || r.x1 > box.left + box.width - 4 || r.y0 < box.top + 4 || r.y1 > box.top + box.height - 4) console.log('OUT OF FRAME:', k, [r.x0, r.x1, r.y0, r.y1].map((v) => v.toFixed(0)).join(','), 'box', [box.left, box.left + box.width, box.top, box.top + box.height].map((v) => v.toFixed(0)).join(','));
}
