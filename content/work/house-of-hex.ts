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
  model: { src: '/models/house-of-hex/house-of-hex.glb', mobile: '/models/house-of-hex/house-of-hex.mobile.glb', screen: { aspect: 0.4621 } },
  object: 'Phone on a stand showing the House of Hex logo',
  fallbacks: placeholderFallbacks('house-of-hex'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('house-of-hex', 'House of Hex'),
};

export default work;
