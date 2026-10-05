import type { Deliverable, Work } from '@/lib/types';
import { imported } from './imported';
import { ALT } from '../alt';
import { correct } from './corrections';
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
 * Overlay content imported from the live Framer site (tools/import-framer.mjs).
 * Imported copy wins over the per-project files; corrections.ts then applies the live-site facts.
 */
function withImport(w: Work): Work {
  const o = imported[w.slug] as (Omit<Partial<Work>, 'deliverables'> & { deliverables?: (Deliverable & { source?: string })[] }) | undefined;
  if (!o) return w;
  const d = o.deliverables
    ?.filter((x) => x.src)
    .map(({ source: _source, ...x }, i) => (ALT[w.slug]?.[i + 1] ? { ...x, alt: ALT[w.slug][i + 1] } : x))
    .slice(0, 8);
  return {
    ...w,
    // the live site sets titles in caps; keep the authored casing unless the name itself differs
    ...(o.title && o.title.toLowerCase() !== w.title.toLowerCase() ? { title: o.title } : {}),
    ...(o.description ? { description: o.description } : {}),
    ...(o.sections ? { sections: o.sections } : {}),
    ...(o.live ? { live: o.live } : {}),
    ...(typeof o.year === 'number' ? { year: o.year } : {}),
    ...(o.role ? { role: o.role } : {}),
    ...(o.scope ? { scope: o.scope } : {}),
    ...(o.client ? { client: o.client } : {}),
    ...(o.clientType ? { clientType: o.clientType } : {}),
    // real deliverables replace the placeholders outright; per-project extras (UV masks) carry over by index
    ...(d && d.length ? { deliverables: d.map((x, i) => (x.type === 'image' && w.deliverables[i]?.type === 'image' && w.deliverables[i].fluorMask ? { ...w.deliverables[i], ...x } : x)) } : {}),
  };
}

/**
 * Every project. Order here is the booth lineup order, left to right:
 * packaging on the flanks, brand + web centre stage. Archive-only
 * projects (inLineup: false) are listed last.
 */
export const works: Work[] = [tooYumm, jswSports, mitooshi, sonde, houseOfHex, bengalT20, sook, shunya, indoThai].map(withImport).map(correct);

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

/** Previous project on the tray (D5): the lineup, wrapping round. */
export function prevWork(slug: string): Work {
  const i = lineup.findIndex((w) => w.slug === slug);
  return lineup[(i - 1 + lineup.length) % lineup.length];
}
