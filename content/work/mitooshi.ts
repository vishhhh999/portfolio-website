import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'mitooshi',
  title: 'Mitooshi',
  disciplines: ['Web', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Laptop with ASCII art on screen',
  fallbacks: placeholderFallbacks('mitooshi'),
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
  uvNotes: [],
  deliverables: (() => {
    const d = placeholderDeliverables('mitooshi', 'Mitooshi');
    // placeholder video deliverable: plays muted as a lit video texture, click opens a player with sound
    d[5] = { type: 'video', src: '/media/screen-test.mp4', sources: [{ src: '/media/screen-test.webm', type: 'video/webm' }], poster: '/media/screen-test-poster.webp', alt: 'Mitooshi, screen recording (placeholder)' };
    return d;
  })(),
};

export default work;
