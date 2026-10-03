import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'sook',
  title: 'SOOK',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  nativeLamp: 'TL84',
  glb: '',
  object: 'Tea box trio',
  fallbacks: placeholderFallbacks('sook'),
  uvNotes: [
    { text: 'Colour system: one hue per blend, shared neutral base', anchor: [0, 0.1, 0.036] },
    { text: 'Die-line: tuck-end, 70 × 70 × 130mm', anchor: [-0.08, 0.06, 0.036] },
    { text: 'Front panel grid shared across all three SKUs', anchor: [0.08, 0.1, 0.036] },
  ],
  deliverables: placeholderDeliverables('sook', 'SOOK'),
};

export default work;
