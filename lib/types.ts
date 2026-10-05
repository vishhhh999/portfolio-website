export const LAMP_IDS = ['D50', 'TL84', 'A', 'UV', 'FLOOD', 'SCREEN', 'AFTERDARK'] as const;
export type Lamp = (typeof LAMP_IDS)[number];

export type UvNote = {
  text: string;
  /** Object-local position in metres, origin at base centre. */
  anchor: [number, number, number];
  /** Where the same note sits on the project's first proof image (0–1 from the top left). */
  proof?: [number, number];
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
  /** Intrinsic pixel size (sets the frame's real aspect ratio in the proof strip). */
  width?: number;
  height?: number;
  /** Extra encodings for video deliverables, tried before `src` (e.g. WebM VP9, then the MP4 in src). */
  sources?: { src: string; type: string }[];
  /** UV notes printed on this proof in invisible ink (the first proof of each project). */
  inkNotes?: { text: string; at: [number, number] }[];
};

export type Work = {
  slug: string;
  title: string;
  /** Case copy, paragraph by paragraph, imported as written. */
  description?: string[];
  /** Headed case sections that follow the intro, imported as written. */
  sections?: { heading: string; body: string[] }[];
  /** The shipped site, for web projects (import only; shown through `links`). */
  live?: string;
  client?: string;
  clientType?: string;
  /** Outbound link buttons (new tab). Only projects with a real destination have one. */
  links?: { label: string; href: string }[];
  disciplines: string[];
  year: number;
  role: string;
  scope: string;
  nativeLamp: Lamp;
  /** R2 URL. Empty until the Blender asset lands (Phase 4). */
  glb: string;
  /**
   * The booth object from Blender (tools/optimize-models.mjs output), in real-world metres. Without
   * one, the procedural object for the project is used. Its display scale is the staging's
   * (components/booth/staging.ts); `rotation` is Euler radians; `plinthOffset` lifts it off its
   * base (metres) if its origin is not at its base; `frontSide` for closed meshes exported two-sided.
   */
  model?: {
    src: string;
    mobile: string;
    rotation?: [number, number, number];
    plinthOffset?: number;
    frontSide?: boolean;
    /** Re-arranged pieces of a multi-node GLB: node name → footprint centre [x, z] (m) and yaw (rad). */
    layout?: Record<string, [number, number, number]>;
    /** A device's `screen` mesh: UV0 0–1 is the visible display, at this aspect (w / h). */
    screen?: { aspect: number };
    /** A display stand under the model: 'wedge' (a sloped block matching the model's tilt, for flat sets). */
    stand?: 'wedge';
    /** The one animated object (A5): the named clip plays to its end while the object is on the tray. */
    animation?: string;
  };
  /** Pre-rendered still per lamp (Phase 6). */
  fallbacks: Record<Lamp, string>;
  /** Approved proofer's notes only (shown under UV). Empty until Vishesh approves them. */
  uvNotes: UvNote[];
  /** Six is the target; when the live site has fewer, the real ones are shown rather than padded with placeholders. */
  deliverables: Deliverable[];
  /** false = archive only: not on the booth floor, listed in /archive and /house-lights. */
  inLineup: boolean;
  /** Hero object description, used for alt text and the house-lights index. */
  object: string;
};
