import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'shunya',
  title: 'SHUNYA',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'A',
  glb: '',
  model: { src: '/models/shunya/shunya.glb', mobile: '/models/shunya/shunya.mobile.glb' },
  object: 'The SHUNYA range: Ritual Set, Bhimseni jar, Air tin and Pooja carton',
  fallbacks: placeholderFallbacks('shunya'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('shunya', 'SHUNYA'),
};

export default work;
