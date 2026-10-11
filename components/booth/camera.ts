import { Box3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { cabinetFace, type Layout } from './composition';
import type { FrameRect } from './frames';

/**
 * Camera framing. The canvas covers the booth layer; the camera contain-fits a box in the booth
 * (the cabinet's face at home, its opening on a project header, the tray on a phone header) into a
 * frame rect on the page, then shifts the lens so that box lands exactly on the rect. The view
 * direction never changes with the rect, so the picture is the same shape at every size.
 */
export type Pose = { look: Vector3; dist: number; shiftX: number; shiftY: number; fov: number; pitch: number };

const tmp = new Vector3();

export function pitchOf(L: Layout) {
  return Math.atan2(L.eye.y - L.eye.lookY, 1.8);
}

export function applyPose(cam: PerspectiveCamera, p: Pose, aspect: number, yaw = 0, tilt = 0) {
  const pitch = p.pitch + tilt;
  cam.fov = p.fov;
  cam.aspect = aspect;
  cam.position.set(p.look.x + Math.sin(yaw) * Math.cos(pitch) * p.dist, p.look.y + Math.sin(pitch) * p.dist, p.look.z + Math.cos(yaw) * Math.cos(pitch) * p.dist);
  cam.lookAt(p.look);
  cam.updateProjectionMatrix();
  const e = cam.projectionMatrix.elements;
  e[8] -= p.shiftX;
  e[9] -= p.shiftY;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld();
}

function ndcBox(cam: PerspectiveCamera, pts: Vector3[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    tmp.copy(p).project(cam);
    x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x);
    y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y);
  }
  return { x0, x1, y0, y1 };
}

function corners(b: Box3) {
  const out: Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z));
  return out;
}

/**
 * Pose that fits `box` into `frame` (layer px) on a canvas of `cw` x `ch` px.
 * `fill` < 1 leaves a margin; `cover` fills the frame (cropping the box) instead of containing it.
 */
export function fitPose(L: Layout, box: Box3, frame: FrameRect, cw: number, ch: number, opts: { fill?: number; cover?: boolean; fov?: number; pitch?: number } = {}): Pose {
  const cam = new PerspectiveCamera();
  const pitch = pitchOf(L) + (opts.pitch ?? 0);
  const look = box.getCenter(new Vector3());
  const pts = corners(box);
  const fill = opts.fill ?? 1;
  const fw = (2 * frame.w * fill) / cw, fh = (2 * frame.h * fill) / ch;
  const pose: Pose = { look, dist: 3, shiftX: 0, shiftY: 0, fov: opts.fov ?? L.eye.fov, pitch };
  for (let i = 0; i < 4; i++) {
    applyPose(cam, pose, cw / ch);
    const b = ndcBox(cam, pts);
    const kx = (b.x1 - b.x0) / fw, ky = (b.y1 - b.y0) / fh;
    const k = opts.cover ? Math.min(kx, ky) : Math.max(kx, ky);
    // projected size goes as 1 / distance from the box's front plane
    const front = pose.dist - (box.max.z - look.z) * Math.cos(pitch);
    pose.dist = Math.max(0.2, pose.dist - front + front * k);
  }
  applyPose(cam, pose, cw / ch);
  const b = ndcBox(cam, pts);
  const cx = ((frame.x + frame.w / 2) / cw) * 2 - 1;
  const cy = 1 - ((frame.y + frame.h / 2) / ch) * 2;
  pose.shiftX = cx - (b.x0 + b.x1) / 2;
  pose.shiftY = cy - (b.y0 + b.y1) / 2;
  return pose;
}

/** The cabinet's whole front face (home). */
export function faceBox(L: Layout) {
  const f = cabinetFace(L);
  return new Box3(new Vector3(-f.w / 2, f.bottom, f.front), new Vector3(f.w / 2, f.bottom + f.h, f.front));
}

/** The opening, slightly inside the trim (project header on wide screens: a gentle push in). */
export function openingBox(L: Layout, inset = 0.04) {
  const { w, h, d } = L.room;
  return new Box3(new Vector3(-w / 2 + inset, -0.012, d / 2), new Vector3(w / 2 - inset, h - inset, d / 2));
}

/** The tray and a little of the booth around it (project header on tall screens). */
export function trayBox(L: Layout, objectH: number) {
  const t = L.tray;
  const r = t.r * 1.8;
  return new Box3(new Vector3(t.x - r, 0, t.z - r * 0.6), new Vector3(t.x + r, t.h + Math.max(objectH, 0.18) * 1.15, t.z + r * 0.6));
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    look: a.look.clone().lerp(b.look, t),
    dist: MathUtils.lerp(a.dist, b.dist, t),
    shiftX: MathUtils.lerp(a.shiftX, b.shiftX, t),
    shiftY: MathUtils.lerp(a.shiftY, b.shiftY, t),
    fov: MathUtils.lerp(a.fov, b.fov, t),
    pitch: MathUtils.lerp(a.pitch, b.pitch, t),
  };
}

/** The motion curve for every camera and object move: cubic-bezier(0.2, 0.7, 0.1, 1). */
export function ease(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // solve the bezier x(s) = t for s, then return y(s)
  const x1 = 0.2, y1 = 0.7, x2 = 0.1, y2 = 1;
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1, s = t;
  for (let i = 0; i < 20; i++) {
    s = (lo + hi) / 2;
    if (bx(s) < t) lo = s;
    else hi = s;
  }
  return by(s);
}
