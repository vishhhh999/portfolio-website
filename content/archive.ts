import type { Deliverable } from '@/lib/types';
import { imported } from './work/imported';

/**
 * The archive: every piece from the live site's /archive canvas (46, imported in its order).
 *
 * The Framer data carries no project, title or year for these pieces, only the image and its
 * alt text. So the series below are WORKING LABELS grouped by what is visibly the same body of
 * work (one 3D scene, one car, one poster series). PLACEHOLDER: rename each to the real project
 * name, set its year, and set `work` to a case-study slug if it belongs to one.
 */
export type ArchiveSeries = {
  id: string;
  /** PLACEHOLDER working label: replace with the real project name. */
  label: string;
  /** PLACEHOLDER: the year, once confirmed. null shows as "Year TBC". */
  year: number | null;
  /** Optional parent case study (a /work slug). Tiles link there when set. */
  work?: string;
  /** 1-based positions in the imported archive order. */
  items: number[];
};

export const ARCHIVE_SERIES: ArchiveSeries[] = [
  { id: 'graphics', label: 'Posters and graphics', year: null, items: [1, 2, 5, 43, 44, 45, 46] },
  { id: 'cd-poster', label: 'CD and poster', year: null, items: [3, 4] },
  { id: 'classroom', label: 'Attic classroom, 3D', year: null, items: [6, 7, 8, 9, 10, 11, 12] },
  { id: 'orange-coupe', label: 'Orange coupe, 3D', year: null, items: [13, 14, 15, 16, 17] },
  { id: 'grey-gt', label: 'Grey GT car, 3D', year: null, items: [18, 19, 20, 21, 22, 23, 24] },
  { id: '3d-studies', label: '3D studies', year: null, items: [25, 33] },
  { id: 'retro-computer', label: 'Retro computer, 3D', year: null, items: [26, 27, 28, 29, 30, 31, 32] },
  { id: 'type-posters', label: 'Type posters', year: null, items: [34, 35, 36, 37] },
  { id: 'blackletter', label: 'Blackletter posters', year: null, items: [38, 39] },
  { id: 'statues', label: 'Classical statue posters', year: null, items: [40, 41, 42] },
];

export type ArchivePiece = Deliverable & { n: number; series: ArchiveSeries };

const raw = (imported.__archive ?? []) as (Deliverable & { source?: string })[];

export const archivePieces: ArchivePiece[] = raw
  .map((d, i) => {
    const n = i + 1;
    const series = ARCHIVE_SERIES.find((s) => s.items.includes(n));
    if (!series) return null;
    const { source: _source, ...rest } = d;
    return { ...rest, n, series };
  })
  .filter((p): p is ArchivePiece => p !== null);
