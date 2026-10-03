import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'jsw-sports',
  title: 'JSW Sports',
  disciplines: ['Editorial', 'Print'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: true,
  nativeLamp: 'D50',
  glb: '',
  object: 'Coffee table book, standing open',
  fallbacks: placeholderFallbacks('jsw-sports'),
  uvNotes: [
    { text: 'Cover type spec: cap height locked to 1/12 of trim', anchor: [-0.1, 0.22, 0.05] },
    { text: 'Colour build: CMYK + Pantone spot for the cover field', anchor: [-0.1, 0.12, 0.05] },
    { text: 'Page grid: 8 col, baseline 12pt', anchor: [0.1, 0.15, 0.05] },
  ],
  deliverables: placeholderDeliverables('jsw-sports', 'JSW Sports'),
};

export default work;
