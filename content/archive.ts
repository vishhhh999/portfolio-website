import type { Deliverable } from '@/lib/types';
import { imported } from './work/imported';
import { avifFor } from './masters';

/**
 * The archive: the pieces from the live site's /archive canvas, in its order, titled by Vish (G1).
 * Titles are keyed by the original A-number (the position in the import) and shown exactly as
 * given, in caps. The displayed number is the piece's place in the sheet, renumbered with no gaps.
 */
export type ArchiveCategory = 'cover-art' | '3d' | 'posters' | 'other';
export const ARCHIVE_CATEGORIES: { id: ArchiveCategory; label: string }[] = [
  { id: 'cover-art', label: 'Music cover art' },
  { id: '3d', label: '3D explorations' },
  { id: 'posters', label: 'Posters' },
  { id: 'other', label: 'Other' },
];

type Title = { title: string; category: ArchiveCategory };
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const TITLES: [number[], Title][] = [
  [[1], { title: 'GOMH - ADHAYAN - MUSIC COVER ART', category: 'cover-art' }],
  [[2], { title: '2FAST - BANZ2FADED - MUSIC COVER ART', category: 'cover-art' }],
  [[3, 4], { title: 'AMNESIA MUSIC COVER ART EXPLORATION FOR SUFR', category: 'cover-art' }],
  [[5], { title: 'ALONE - 3D EXPLORATION', category: '3d' }],
  [range(6, 12), { title: 'HOGWARTS CLASSROOM - 3D EXPLORATION - MADE IN UNREAL ENGINE', category: '3d' }],
  [range(13, 17), { title: 'MERCEDES-BENZ AMG GTR - 3D EXPLORATION', category: '3d' }],
  [range(18, 24), { title: 'PORSCHE GT3 RS 3D EXPLORATION', category: '3d' }],
  [[25], { title: 'POTTERY 3D EXPLORATION', category: '3d' }],
  [range(26, 32), { title: 'A RETRO COMPUTER', category: '3d' }],
  [[33], { title: 'WORSHIP - 3D EXPLORATION', category: '3d' }],
  [range(34, 43), { title: 'POSTERS EXPLORATION', category: 'posters' }],
  [[44], { title: 'ZEHER - RORO & SAIF - MUSIC COVER ART', category: 'cover-art' }],
  [[45], { title: 'FLAG FOR YUNOXX, A MUSIC ARTIST', category: 'other' }],
  [[46], { title: 'MOKSHA - REESH - MUSIC COVER ART EXPLORATION', category: 'cover-art' }],
];
const titleFor = (n: number) => TITLES.find(([ns]) => ns.includes(n))?.[1] ?? null;

/**
 * Removed as duplicates by tools/dedupe-archive.py (pHash distance <= 4):
 *   29: identical to 28 (pHash 0), the same retro computer render with a watermark added.
 */
export const DUPLICATES_REMOVED = [29];

/** G2: the AMG GTR clips (assets-src/archive/amg-gtr), after the last AMG still. 960px square loops. */
const AMG_CLIPS: { n: string; alt: string }[] = [
  { n: 'amg-gtr-1', alt: 'An orange Mercedes-AMG GT R in a pale room with wooden floorboards and sheer curtains, the camera moving in to the bonnet badge.' },
  { n: 'amg-gtr-2', alt: 'An orange Mercedes-AMG GT R facing the camera head on in a white studio, small orange leaves drifting past.' },
  { n: 'amg-gtr-3', alt: 'The Mercedes-Benz badge turning into a spinning wheel on a light grey ground.' },
  { n: 'amg-gtr-4', alt: 'The Mercedes-AMG GT R as a wireframe in the same room, the render resolving back to the orange car.' },
];

export type ArchivePiece = Deliverable & {
  /** The displayed number: the place in the sheet, no gaps. */
  no: number;
  /** The original A-number (the live archive's order), or null for an added clip. */
  a: number | null;
  title: string;
  category: ArchiveCategory;
  avif: string | null;
};

const raw = (imported.__archive ?? []) as (Deliverable & { source?: string })[];

const stills = raw
  .map((d, i) => {
    const a = i + 1;
    const t = titleFor(a);
    if (!t || DUPLICATES_REMOVED.includes(a)) return null;
    const { source: _source, ...rest } = d;
    return { ...rest, a, ...t, avif: avifFor(rest.src) };
  })
  .filter((p) => p !== null);

const lastAmg = stills.findIndex((p) => p.a === 17);
const clips = AMG_CLIPS.map((c) => ({
  type: 'video' as const,
  src: `/archive/clips/${c.n}.mp4`,
  sources: [{ src: `/archive/clips/${c.n}.webm`, type: 'video/webm; codecs=vp9' }],
  poster: `/archive/clips/${c.n}-poster.webp`,
  alt: c.alt,
  width: 960,
  height: 960,
  a: null,
  title: 'MERCEDES-BENZ AMG GTR - 3D EXPLORATION',
  category: '3d' as const,
  avif: null,
}));

export const archivePieces: ArchivePiece[] = [...stills.slice(0, lastAmg + 1), ...clips, ...stills.slice(lastAmg + 1)].map((p, i) => ({ ...p, no: i + 1 }));
