import { BOOTH, CABINET, CABINET_FACE, FOV, LIP, SHOT, STAGING, TRAY } from './staging';

export type Shot = { target: [number, number, number]; position: [number, number, number]; dist: number };

const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);

/**
 * Lineup shot: a level camera looking into the booth.
 * Vertical: the lip top lands at SHOT.lipV and the ceiling's back edge at
 * SHOT.ceilingV, so you always see floor, back wall, side walls and the lit
 * ceiling meet in corners. Horizontal: the back wall never fills less than
 * SHOT.minWallFrame of the booth width, so the side walls stay in view.
 * Distances are to the back wall.
 */
export function lineupShot(aspect: number): Shot {
  const tanH = tanV * aspect;
  const L = BOOTH.frontZ - BOOTH.backZ;
  // vertical solve: H − ye = ceilingV·d·t  and  ye = lipTop − lipV·(d − L)·t
  const dV = (BOOTH.height - LIP.h - SHOT.lipV * L * tanV) / ((SHOT.ceilingV - SHOT.lipV) * tanV);
  const dH = (BOOTH.width * SHOT.minWallFrame) / 2 / tanH;
  const d = Math.max(dV, dH);
  const camZ = BOOTH.backZ + d;
  const ye = LIP.h - SHOT.lipV * (camZ - BOOTH.frontZ) * tanV;
  return { target: [0, ye, BOOTH.backZ], position: [0, ye, camZ], dist: d };
}

/** Tray shot: the active sample alone on the tray, level, owning the frame. */
export function trayShot(slug: string, aspect: number): Shot {
  const { w, h } = STAGING[slug].object;
  const tanH = tanV * aspect;
  const fitH = Math.max(h * 1.65, 0.26);
  const fitW = Math.max(w * 1.6, 0.36);
  const dist = Math.max(fitH / 2 / tanV, fitW / 2 / tanH);
  const y = TRAY.top + h * 0.5;
  return { target: [0, y, TRAY.z], position: [0, y, TRAY.z + dist], dist };
}

export type FramedShot = Shot & { offset: [number, number] };

/**
 * Cabinet shot (home): the whole booth cabinet as an object on the page, placed
 * into `box` (CSS px, relative to the stage). Contain-fit the cabinet's front
 * face, aligned to the box's left and bottom; a level camera on the face centre
 * keeps the interior perspective symmetric, and a view offset (shifted lens, no
 * tilt) moves it into place.
 */
export function cabinetShot(
  stage: { width: number; height: number },
  box: { left: number; top: number; width: number; height: number },
  focus?: { x: number; z: number } | null,
): FramedShot {
  const { w: Wc, h: Hc, bottom } = CABINET_FACE;
  // Landscape box: the whole cabinet fills the column's width. Portrait box (phones): the cabinet
  // fills the height and is cropped left/right, panned to the focused sample (swipe between them).
  const portrait = box.width / box.height < 1;
  const s = portrait ? box.height / Hc : box.width / Wc; // px per metre at the face plane
  const dist = stage.height / (2 * s * tanV);
  const cy = bottom + Hc / 2;
  const z = BOOTH.frontZ + CABINET.proud;
  let centreX = box.left + box.width / 2;
  if (portrait && focus) {
    // lens shift is a 2D pan: a sample deeper in the booth moves by its perspective-scaled x
    const k = dist / (dist + (z - focus.z));
    centreX -= focus.x * s * k;
    const half = (Wc * s) / 2;
    centreX = Math.min(box.left + half, Math.max(box.left + box.width - half, centreX));
  }
  const centreY = box.top + box.height - (Hc * s) / 2;
  return {
    target: [0, cy, z],
    position: [0, cy, z + dist],
    dist,
    offset: [stage.width / 2 - centreX, stage.height / 2 - centreY],
  };
}
