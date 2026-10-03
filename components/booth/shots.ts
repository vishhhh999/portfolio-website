import { BOOTH, FOV, LIP, SHOT, STAGING, TRAY } from './staging';

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
