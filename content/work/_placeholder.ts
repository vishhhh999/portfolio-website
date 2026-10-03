import { LAMP_IDS, type Lamp, type Work } from '@/lib/types';

/** Placeholder media until real renders and deliverables land (Phases 4–6). */
export function placeholderFallbacks(slug: string): Record<Lamp, string> {
  return Object.fromEntries(LAMP_IDS.map((l) => [l, `/fallbacks/${slug}/${l.toLowerCase()}.avif`])) as Record<Lamp, string>;
}

export function placeholderDeliverables(slug: string, title: string): Work['deliverables'] {
  const d = (i: number) => ({ type: 'image' as const, src: `/work/${slug}/0${i}.avif`, alt: `${title}, deliverable ${i}` });
  return [d(1), d(2), d(3), d(4), d(5), d(6)];
}
