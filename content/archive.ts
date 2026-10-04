import type { Deliverable } from '@/lib/types';
import { imported } from './work/imported';
import { avifFor } from './masters';

/**
 * The archive: the pieces from the live site's /archive canvas, in its order.
 *
 * The Framer data carries no project, title or year for these pieces, only the image and its alt
 * text. So each series label is a plain description of what is visibly the same body of work
 * (one 3D scene, one car, one poster series). No years, no invented names, and no links: none
 * of these pieces is visibly part of a case study.
 */
export type ArchiveSeries = {
  id: string;
  /** A plain description of what is visible. */
  label: string;
  /** 1-based positions in the imported archive order. */
  items: number[];
};

export const ARCHIVE_SERIES: ArchiveSeries[] = [
  { id: 'graphics', label: 'Posters and graphics', items: [1, 2, 5, 43, 44, 45, 46] },
  { id: 'cd-poster', label: 'CD and poster', items: [3, 4] },
  { id: 'classroom', label: '3D: attic classroom', items: [6, 7, 8, 9, 10, 11, 12] },
  { id: 'orange-coupe', label: '3D: orange coupe', items: [13, 14, 15, 16, 17] },
  { id: 'grey-gt', label: '3D: grey GT car', items: [18, 19, 20, 21, 22, 23, 24] },
  { id: '3d-studies', label: '3D: studies', items: [25, 33] },
  { id: 'retro-computer', label: '3D: retro computer', items: [26, 27, 28, 30, 31, 32] },
  { id: 'type-posters', label: 'Type posters', items: [34, 35, 36, 37] },
  { id: 'blackletter', label: 'Blackletter posters', items: [38, 39] },
  { id: 'statues', label: 'Classical statue posters', items: [40, 41, 42] },
];

/**
 * Removed as duplicates by tools/dedupe-archive.py (pHash distance <= 4):
 *   29: identical to 28 (pHash 0), the same retro computer render with a watermark added.
 */
export const DUPLICATES_REMOVED = [29];

export type ArchivePiece = Deliverable & { n: number; series: ArchiveSeries; avif: string | null };

const raw = (imported.__archive ?? []) as (Deliverable & { source?: string })[];

export const archivePieces: ArchivePiece[] = raw
  .map((d, i) => {
    const n = i + 1;
    const series = ARCHIVE_SERIES.find((s) => s.items.includes(n));
    if (!series) return null;
    const { source: _source, ...rest } = d;
    return { ...rest, n, series, avif: avifFor(rest.src) };
  })
  .filter((p): p is ArchivePiece => p !== null);
