import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'mitooshi',
  title: 'Mitooshi',
  disciplines: ['Web', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  model: { src: '/models/mitooshi/mitooshi.glb', mobile: '/models/mitooshi/mitooshi.mobile.glb', screen: { aspect: 1.5224 }, center: true },
  object: 'Laptop showing the Mitooshi logo',
  fallbacks: placeholderFallbacks('mitooshi'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('mitooshi', 'Mitooshi'),
};

export default work;
