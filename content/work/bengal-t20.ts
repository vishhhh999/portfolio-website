import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'bengal-t20',
  title: 'Bengal T20 League',
  disciplines: ['Brand identity', 'Sport'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'FLOOD',
  glb: '',
  object: 'Folded flag, match ticket and jersey swatch stack',
  fallbacks: placeholderFallbacks('bengal-t20'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('bengal-t20', 'Bengal T20 League'),
};

export default work;
