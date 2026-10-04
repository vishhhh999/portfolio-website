import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'indo-thai',
  title: 'Indo Thai',
  disciplines: ['Web', '3D'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: false,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Laptop',
  fallbacks: placeholderFallbacks('indo-thai'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('indo-thai', 'Indo Thai'),
};

export default work;
