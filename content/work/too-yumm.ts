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
  deliverables: (() => {
    const d = placeholderDeliverables('too-yumm', 'Too Yumm');
    // UV test masks: proves the proof-strip planes carry fluorMask + uvInk like the 3D objects
    d[0] = { ...d[0], fluorMask: '/work/too-yumm/01-fluor.webp', uvInk: '/work/too-yumm/01-uvink.webp' };
    d[1] = { ...d[1], fluorMask: '/work/too-yumm/02-fluor.webp', uvInk: '/work/too-yumm/02-uvink.webp' };
    return d;
  })(),
};

export default work;
