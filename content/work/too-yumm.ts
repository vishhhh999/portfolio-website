import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'too-yumm',
  title: 'Too Yumm',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: true,
  nativeLamp: 'TL84',
  glb: '',
  object: 'Standing pouch',
  fallbacks: placeholderFallbacks('too-yumm'),
  uvNotes: [
    { text: 'Pouch construction grid: 12 col, 6mm gutter', anchor: [0, 0.16, 0.036] },
    { text: 'Window sized so the product reads from 2m shelf distance', anchor: [0, 0.09, 0.036] },
    { text: 'Type hierarchy: flavour > brand > claim', anchor: [0, 0.2, 0.036] },
  ],
  deliverables: placeholderDeliverables('too-yumm', 'Too Yumm'),
};

export default work;
