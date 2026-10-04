import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'house-of-hex',
  title: 'House of Hex',
  disciplines: ['Product UI', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Phone on a small stand',
  fallbacks: placeholderFallbacks('house-of-hex'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('house-of-hex', 'House of Hex'),
};

export default work;
