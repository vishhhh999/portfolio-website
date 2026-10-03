import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'bengal-t20',
  title: 'Bengal T20 League',
  disciplines: ['Brand identity', 'Sport'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: true,
  nativeLamp: 'FLOOD',
  glb: '',
  object: 'Folded flag, match ticket and jersey swatch stack',
  fallbacks: placeholderFallbacks('bengal-t20'),
  uvNotes: [
    { text: 'Logo construction: built on a 30° stadium-arc grid', anchor: [0, 0.07, 0.08] },
    { text: 'Identity grid scales from ticket to stadium wrap', anchor: [0, 0.04, 0.08] },
    { text: 'Minimum clear space = height of the B counter', anchor: [0.06, 0.07, 0.08] },
  ],
  deliverables: placeholderDeliverables('bengal-t20', 'Bengal T20 League'),
};

export default work;
