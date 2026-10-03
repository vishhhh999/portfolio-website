import { FLOOR_LINE, FOV, LINEUP_MARGIN, STAGING, TRAY, lineupLayout } from './staging';

export type Shot = { target: [number, number, number]; position: [number, number, number]; dist: number };

const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);

/**
 * Lineup shot: level camera, frame width = lineup × margin, eye height chosen
 * so the floor line lands FLOOR_LINE of the way down the frame.
 */
export function lineupShot(slugs: string[], aspect: number): Shot {
  const { width } = lineupLayout(slugs);
  const tanH = tanV * aspect;
  const dist = (width * LINEUP_MARGIN) / 2 / tanH;
  const y = (FLOOR_LINE - 0.5) * 2 * dist * tanV;
  return { target: [0, y, 0], position: [0, y, dist], dist };
}

/** Tray shot: the active object alone on the proofing tray, level, filling the frame with room to breathe. */
export function trayShot(slug: string, aspect: number): Shot {
  const { w, h } = STAGING[slug].object;
  const tanH = tanV * aspect;
  const fitH = Math.max(h * 2.4, 0.5);
  const fitW = Math.max(w * 2.2, 0.8);
  const dist = Math.max(fitH / 2 / tanV, fitW / 2 / tanH);
  const y = h * 0.55;
  return { target: [0, y, TRAY.z], position: [0, y, TRAY.z + dist], dist };
}
