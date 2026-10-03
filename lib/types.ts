export const LAMP_IDS = ['D50', 'TL84', 'A', 'UV', 'FLOOD', 'SCREEN', 'AFTERDARK'] as const;
export type Lamp = (typeof LAMP_IDS)[number];

export type UvNote = {
  text: string;
  /** Object-local position in metres, origin at base centre. */
  anchor: [number, number, number];
};

export type Deliverable = {
  type: 'image' | 'video';
  src: string;
  alt: string;
  /** Optional UV slots for the lit proof strip (same meaning as on 3D objects). */
  fluorMask?: string;
  uvInk?: string;
  /** Still frame for video deliverables (shown until the video plays). */
  poster?: string;
  /** Extra encodings for video deliverables, tried before `src` (e.g. WebM VP9, then the MP4 in src). */
  sources?: { src: string; type: string }[];
};

export type Work = {
  slug: string;
  title: string;
  /** Case copy, paragraph by paragraph, imported as written. */
  description?: string[];
  client?: string;
  clientType?: string;
  credits?: string;
  disciplines: string[];
  year: number;
  role: string;
  scope: string;
  nativeLamp: Lamp;
  /** R2 URL. Empty until the Blender asset lands (Phase 4). */
  glb: string;
  /** Pre-rendered still per lamp (Phase 6). */
  fallbacks: Record<Lamp, string>;
  /** 3 to 6. */
  uvNotes: UvNote[];
  /** Exactly 6. */
  deliverables: [Deliverable, Deliverable, Deliverable, Deliverable, Deliverable, Deliverable];
  behance?: string;
  /** false = archive only: not on the booth floor, listed in /archive and /index. */
  inLineup: boolean;
  /** Hero object description, used for alt text and the house-lights index. */
  object: string;
};
