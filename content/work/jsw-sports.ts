import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'jsw-sports',
  title: 'JSW Sports',
  disciplines: ['Editorial', 'Print'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'D50',
  glb: '',
  model: { src: '/models/jsw-sports/jsw-sports.glb', mobile: '/models/jsw-sports/jsw-sports.mobile.glb' },
  object: 'Coffee table book, standing open',
  fallbacks: placeholderFallbacks('jsw-sports'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('jsw-sports', 'JSW Sports'),
};

export default work;
