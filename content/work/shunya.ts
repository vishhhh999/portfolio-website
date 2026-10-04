import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'shunya',
  title: 'SHUNYA',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: false,
  nativeLamp: 'A',
  glb: '',
  object: 'Camphor jar and tin',
  fallbacks: placeholderFallbacks('shunya'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('shunya', 'SHUNYA'),
};

export default work;
