import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'sonde',
  title: 'Sonde',
  disciplines: ['Product UI', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  model: { src: '/models/sonde/sonde.glb', mobile: '/models/sonde/sonde.mobile.glb', screen: { aspect: 1.3327 } },
  object: 'Tablet on an easel showing the Sonde logo',
  fallbacks: placeholderFallbacks('sonde'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('sonde', 'Sonde'),
};

export default work;
