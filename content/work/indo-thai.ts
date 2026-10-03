import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'indo-thai',
  title: 'Indo Thai',
  disciplines: ['Web', '3D'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: false,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Laptop',
  fallbacks: placeholderFallbacks('indo-thai'),
  uvNotes: [
    { text: 'Layout grid: 12 col, content max 1200px', anchor: [0, 0.12, -0.08] },
    { text: '3D scene sits on the grid, not over it', anchor: [0, 0.16, -0.08] },
    { text: 'Hero render lit to match the page palette', anchor: [0.1, 0.08, -0.08] },
  ],
  deliverables: placeholderDeliverables('indo-thai', 'Indo Thai'),
};

export default work;
