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
  uvNotes: [
    { text: 'Layout grid: 12 col, 24px gutter', anchor: [0, 0.12, -0.08] },
    { text: 'ASCII system: one glyph ramp drives every illustration', anchor: [0, 0.16, -0.08] },
    { text: 'Type scale: 1.25 ratio, mono for data', anchor: [-0.1, 0.08, -0.08] },
  ],
  deliverables: (() => {
    const d = placeholderDeliverables('mitooshi', 'Mitooshi');
    // placeholder video deliverable: plays muted as a lit video texture, click opens a player with sound
    d[5] = { type: 'video', src: '/media/screen-test.mp4', sources: [{ src: '/media/screen-test.webm', type: 'video/webm' }], poster: '/media/screen-test-poster.webp', alt: 'Mitooshi, screen recording (placeholder)' };
    return d;
  })(),
};

export default work;
