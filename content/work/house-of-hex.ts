import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'house-of-hex',
  title: 'House of Hex',
  disciplines: ['Product UI', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Phone on a small stand',
  fallbacks: placeholderFallbacks('house-of-hex'),
  uvNotes: [
    { text: 'Spacing tokens: 4 / 8 / 12 / 16 / 24 / 32', anchor: [0, 0.1, 0.01] },
    { text: '4-col mobile grid, 16px margins', anchor: [0, 0.06, 0.01] },
    { text: 'Tap targets ≥ 44px', anchor: [0, 0.03, 0.01] },
  ],
  deliverables: placeholderDeliverables('house-of-hex', 'House of Hex'),
};

export default work;
