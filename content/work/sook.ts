import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'sook',
  title: 'SOOK',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'TL84',
  glb: '',
  object: 'Tea box trio',
  fallbacks: placeholderFallbacks('sook'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('sook', 'SOOK'),
};

export default work;
