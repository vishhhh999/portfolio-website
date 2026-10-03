import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'shunya',
  title: 'SHUNYA',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: false,
  nativeLamp: 'A',
  glb: '',
  object: 'Camphor jar and tin',
  fallbacks: placeholderFallbacks('shunya'),
  uvNotes: [
    { text: 'Label construction: wrap height = jar height × 0.5', anchor: [-0.05, 0.05, 0.04] },
    { text: 'Ritual set system: jar, tin, refill share one mark', anchor: [0.06, 0.03, 0.05] },
    { text: 'Mark sits on the optical centre, not the geometric one', anchor: [-0.05, 0.07, 0.04] },
  ],
  deliverables: placeholderDeliverables('shunya', 'SHUNYA'),
};

export default work;
