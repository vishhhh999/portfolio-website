import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'indo-thai',
  title: 'Indo Thai',
  disciplines: ['Web', '3D'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  model: { src: '/models/indo-thai/indo-thai.glb', mobile: '/models/indo-thai/indo-thai.mobile.glb', rotation: [0, -0.95, 0] },
  object: 'Aircraft pushback tug with tow bar, a display model',
  fallbacks: placeholderFallbacks('indo-thai'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('indo-thai', 'Indo Thai'),
};

export default work;
