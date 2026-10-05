import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { BOOTH, CABINET_FACE, EYE, FACE_Z, FOV, STAGING, TRAY } from './staging.ts';

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
    // pan so the focused sample sits at the box centre, without showing past the cabinet's sides
    cam.position.set(...shot.position);
    cam.lookAt(...shot.target);
    cam.updateMatrixWorld();
    v.set(focus.x, EYE.y * 0.5, focus.z).project(cam);
    const fx = ((v.x + 1) / 2) * stage.width;
    dx = box.left + box.width / 2 - fx;
    dx = Math.min(box.left - fb.l, Math.max(box.left + box.width - fb.r, dx));
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
  const { object, trayW } = STAGING[slug];
  const { h } = object;
  const w = trayW ?? object.w;
  const tanH = tanV * aspect;
  const fitH = Math.max(h * 1.7, 0.26);
  const fitW = Math.max(w * 1.6, 0.36);
  const dist = Math.max(fitH / 2 / tanV, fitW / 2 / tanH);
  const cy = TRAY.top + h * 0.5;
  // stand back along the pitched axis from the sample's centre
  const position: [number, number, number] = [0, cy - Math.sin(PITCH) * dist, TRAY.z + Math.cos(PITCH) * dist];
  return { target: [0, cy, TRAY.z], position, dist };
}
