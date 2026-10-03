import type { Work } from '@/lib/types';
import tooYumm from './too-yumm';
import sook from './sook';
import shunya from './shunya';
import jswSports from './jsw-sports';
import bengalT20 from './bengal-t20';
import mitooshi from './mitooshi';
import houseOfHex from './house-of-hex';
import indoThai from './indo-thai';
import sonde from './sonde';

/**
 * Every project. Order here is the booth lineup order, left to right:
 * packaging on the flanks, brand + web centre stage. Archive-only
 * projects (inLineup: false) are listed last.
 */
export const works: Work[] = [
  tooYumm,
  jswSports,
  mitooshi,
  sonde,
  houseOfHex,
  bengalT20,
  sook,
  shunya,
  indoThai,
];

/** The 7 objects on the booth floor. */
export const lineup: Work[] = works.filter((w) => w.inLineup);
/** Projects that live in /archive, not in the booth. */
export const archive: Work[] = works.filter((w) => !w.inLineup);

export const getWork = (slug: string) => works.find((w) => w.slug === slug);
export const isInLineup = (slug: string) => lineup.some((w) => w.slug === slug);

/** Next project on the tray. Lineup projects cycle the lineup; archive projects lead back into it. */
export function nextWork(slug: string): Work {
  const i = lineup.findIndex((w) => w.slug === slug);
  return lineup[(i + 1) % lineup.length];
}
