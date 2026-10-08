import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { BOOTH, CABINET_FACE, EYE, FACE_Z, FOV, RECEDE_DZ, STAGING, TRAY } from './staging.ts';

/**
 * A camera pose: where it stands, what it looks at (pitched EYE.pitchDeg down), and a lens shift
 * (view offset, CSS px of the stage) that places the picture in the page layout.
 */
export type Shot = { target: [number, number, number]; position: [number, number, number]; dist: number };
export type FramedShot = Shot & { offset: [number, number] };

const PITCH = MathUtils.degToRad(EYE.pitchDeg);
const tanV = Math.tan(MathUtils.degToRad(FOV / 2));

/** Camera on the booth's centre line at eye height, `dist` in front of the face plane, pitched down. */
function pose(dist: number): Shot {
  const position: [number, number, number] = [0, EYE.y, FACE_Z + dist];
  // look along the pitched axis to a point roughly at the back wall
  const reach = dist + (FACE_Z - BOOTH.backZ);
  const target: [number, number, number] = [0, EYE.y + Math.tan(PITCH) * reach, FACE_Z + dist - reach];
  return { position, target, dist };
}

/** C3: the cabinet's height relative to the portrait box on phones (1: exactly the box). */
const PHONE_ZOOM = 1;

const cam = new PerspectiveCamera(FOV, 1, 0.05, 20);
const v = new Vector3();

/** The cabinet's front-face corners projected for a pose: bbox in stage CSS px. */
function faceBox(shot: Shot, stage: { width: number; height: number }) {
  cam.aspect = stage.width / stage.height;
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  const hw = CABINET_FACE.w / 2;
  for (const x of [-hw, hw])
    for (const y of [CABINET_FACE.bottom, CABINET_FACE.bottom + CABINET_FACE.h]) {
      v.set(x, y, FACE_Z).project(cam);
      const px = ((v.x + 1) / 2) * stage.width;
      const py = ((1 - v.y) / 2) * stage.height;
      l = Math.min(l, px);
      r = Math.max(r, px);
      t = Math.min(t, py);
      b = Math.max(b, py);
    }
  return { l, r, t, b, w: r - l, h: b - t };
}

const cache = new Map<string, FramedShot>();

/**
 * Cabinet shot (home): the whole cabinet as an object on the page, placed into `box` (CSS px,
 * relative to the stage). The camera keeps its height and pitch; its distance is solved so the
 * cabinet's projected outline contain-fits the box (landscape: the box's width; portrait: its
 * height, cropped left/right and panned to the focused sample), then a lens shift moves the
 * outline onto the box's left and bottom edges.
 */
export function cabinetShot(
  stage: { width: number; height: number },
  box: { left: number; top: number; width: number; height: number },
  focus?: { x: number; z: number } | null,
): FramedShot {
  const key = [stage.width, stage.height, box.left, box.top, box.width, box.height, focus?.x ?? '', focus?.z ?? ''].map((n) => (typeof n === 'number' ? n.toFixed(1) : n)).join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const portrait = box.width / box.height < 1;
  // the drawn silhouette (antialiased edge, chamfered frame) reaches ~1px past the face's projected
  // corners: fit a landscape cabinet 1px inside the box on each side, so it never draws past its frame
  if (!portrait) box = { left: box.left + 1, top: box.top + 1, width: box.width - 2, height: box.height - 1 };
  // bisection on distance: projected size falls monotonically as the camera backs off
  let lo = 0.3, hi = 30;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const fb = faceBox(pose(mid), stage);
    // C3: phones get their own portrait shot: the cabinet's height fills the box, panned to the focused
    // sample. (It can't be framed tighter: the booth draws into the whole stage, so anything past the
    // box would land on the headline.)
    const fits = portrait ? fb.h <= box.height * PHONE_ZOOM : fb.w <= box.width && fb.h <= box.height;
    if (fits) hi = mid;
    else lo = mid;
  }
  const shot = pose(hi);
  const fb = faceBox(shot, stage);
  let dx = box.left - fb.l + (box.width - fb.w) / 2;
  if (portrait && focus) {
    // G (08): the phone arrangement is composed to sit whole in the portrait box, so a swipe only
    // leans the frame a little toward the focused sample (≤ 2.5% of the box width): a short move
    // that keeps every object in frame
    cam.position.set(...shot.position);
    cam.lookAt(...shot.target);
    cam.updateMatrixWorld();
    v.set(focus.x, EYE.y * 0.5, focus.z).project(cam);
    const fx = ((v.x + 1) / 2) * stage.width;
    const lean = box.width * 0.025;
    dx += Math.max(-lean, Math.min(lean, (box.left + box.width / 2 - fx) * 0.15));
  }
  const dy = portrait ? box.top + box.height / 2 - (fb.t + fb.b) / 2 : box.top + box.height - fb.b;
  // setViewOffset moves the picture by -offset: a positive dx (move right) is a negative offset
  const out: FramedShot = { ...shot, offset: [-dx, -dy] };
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}

/** Lineup shot without a page layout box: the cabinet filling the stage. */
export function lineupShot(aspect: number): FramedShot {
  const stage = { width: 1000 * aspect, height: 1000 };
  return cabinetShot(stage, { left: 40, top: 40, width: stage.width - 80, height: stage.height - 80 });
}

/** Tray shot: the active sample alone on the tray, the same lens and pitch, owning the frame. */
export function trayShot(slug: string, aspect: number): Shot {
  const { object, trayBox } = STAGING[slug];
  const { h } = object;
  if (trayBox) return boxShot(trayBox, h, aspect);
  const w = object.w;
  const tanH = tanV * aspect;
  const fitH = Math.max(h * 1.7, 0.26);
  const fitW = Math.max(w * 1.6, 0.36);
  const dist = Math.max(fitH / 2 / tanV, fitW / 2 / tanH);
  const cy = TRAY.top + h * 0.5;
  // stand back along the pitched axis from the sample's centre
  const position: [number, number, number] = [0, cy - Math.sin(PITCH) * dist, TRAY.z + Math.cos(PITCH) * dist];
  return { target: [0, cy, TRAY.z], position, dist };
}

/**
 * A7 (09): a sample whose tray footprint is a 3D box (the open JSW book: the front cover swings out
 * to the left and toward the camera) is framed on that box's projected outline, not on its width: the
 * camera backs off until all eight corners fit the same share of the frame as every other sample
 * (1 / 1.6 of the width, 1 / 1.7 of the height), then shifts so the outline is centred. The open book
 * is centred and whole at every aspect, its near lower corner included.
 */
const boxCache = new Map<string, Shot>();
function boxShot(b: { x0: number; x1: number; z0: number; z1: number }, h: number, aspect: number): Shot {
  const key = `${b.x0},${b.x1},${b.z0},${b.z1},${h},${aspect.toFixed(3)}`;
  const hit = boxCache.get(key);
  if (hit) return hit;
  const corners: [number, number, number][] = [];
  for (const x of [b.x0, b.x1]) for (const y of [TRAY.top, TRAY.top + h]) for (const z of [TRAY.z + b.z0, TRAY.z + b.z1]) corners.push([x, y, z]);
  cam.aspect = aspect;
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
  const at = (t: [number, number, number], dist: number) => {
    cam.position.set(t[0], t[1] - Math.sin(PITCH) * dist, t[2] + Math.cos(PITCH) * dist);
    cam.lookAt(...t);
    cam.updateMatrixWorld();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of corners) {
      v.set(...c).project(cam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { x0, y0, x1, y1 };
  };
  const target: [number, number, number] = [(b.x0 + b.x1) / 2, TRAY.top + h / 2, TRAY.z + (b.z0 + b.z1) / 2];
  let dist = 1;
  for (let pass = 0; pass < 4; pass++) {
    let lo = 0.2, hi = 20;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const r = at(target, mid);
      if (r.x1 - r.x0 <= 2 / 1.6 && r.y1 - r.y0 <= 2 / 1.7) hi = mid;
      else lo = mid;
    }
    dist = hi;
    // centre the projected outline: move the aim point across the image plane by the outline's offset
    const r = at(target, dist);
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const halfH = Math.tan(MathUtils.degToRad(FOV / 2)) * dist, halfW = halfH * aspect;
    const right = new Vector3(1, 0, 0), up = new Vector3(0, Math.cos(PITCH), -Math.sin(PITCH));
    target[0] += right.x * cx * halfW;
    target[1] += up.y * cy * halfH;
    target[2] += up.z * cy * halfH;
  }
  const shot: Shot = { target, position: [target[0], target[1] - Math.sin(PITCH) * dist, target[2] + Math.cos(PITCH) * dist], dist };
  if (boxCache.size > 64) boxCache.clear();
  boxCache.set(key, shot);
  return shot;
}

/**
 * F1 (08): what the tray shot shows besides the tray object. Each other sample (receded by
 * RECEDE_DZ, as it stands while something is on the tray) is projected through the tray camera; it
 * stays (dimmed) only if it is wholly inside the frame, with a 2% margin, and clear of the tray
 * object's box. Anything that would overlap the tray object's silhouette or be cut by the frame edge
 * drops out with its base. Returns the slugs to hide.
 */
const hideCache = new Map<string, Set<string>>();
export function trayHidden(slug: string, aspect: number): Set<string> {
  const key = `${slug}:${aspect.toFixed(2)}`;
  const hit = hideCache.get(key);
  if (hit) return hit;
  const shot = trayShot(slug, aspect);
  cam.aspect = aspect;
  cam.clearViewOffset();
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const project = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
      v.set(x, y, z).project(cam);
      a = Math.min(a, v.x); c = Math.max(c, v.x); b = Math.min(b, v.y); d = Math.max(d, v.y);
    }
    return { x0: a, y0: b, x1: c, y1: d };
  };
  const st = STAGING[slug];
  const tb = st.trayBox ?? { x0: -st.object.w / 2, x1: st.object.w / 2, z0: -st.object.d / 2, z1: st.object.d / 2 };
  const tray = project(tb.x0, tb.x1, TRAY.top, TRAY.top + st.object.h, TRAY.z + tb.z0, TRAY.z + tb.z1);
  const pad = 0.04; // NDC: 2% of the frame
  const out = new Set<string>();
  for (const [k, o] of Object.entries(STAGING)) {
    if (k === slug) continue;
    const z = o.z + RECEDE_DZ;
    const r = project(o.x - o.object.w / 2, o.x + o.object.w / 2, o.base.h, o.base.h + o.object.h, z - o.object.d / 2, z + o.object.d / 2);
    const inside = r.x0 > -1 + pad && r.x1 < 1 - pad && r.y0 > -1 + pad && r.y1 < 1 - pad;
    const overlaps = r.x0 < tray.x1 + pad && r.x1 > tray.x0 - pad && r.y0 < tray.y1 + pad && r.y1 > tray.y0 - pad;
    if (!inside || overlaps) out.add(k);
  }
  if (hideCache.size > 64) hideCache.clear();
  hideCache.set(key, out);
  return out;
}
