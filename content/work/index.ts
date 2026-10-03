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
 * Lineup order, left to right on the booth floor.
 * Brand + web pieces centre stage, packaging-heavy pieces on the flanks.
 */
export const works: Work[] = [
  tooYumm,
  sook,
  jswSports,
  mitooshi,
  sonde,
  houseOfHex,
  bengalT20,
  indoThai,
  shunya,
];

export const getWork = (slug: string) => works.find((w) => w.slug === slug);

export function nextWork(slug: string): Work {
  const i = works.findIndex((w) => w.slug === slug);
  return works[(i + 1) % works.length];
}
