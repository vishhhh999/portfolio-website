import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'too-yumm',
  title: 'Too Yumm',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'TL84',
  glb: '',
  object: 'Standing pouch',
  fallbacks: placeholderFallbacks('too-yumm'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: (() => {
    const d = placeholderDeliverables('too-yumm', 'Too Yumm');
    // UV: white-ink fluorescence only (physical); no notes until approved
    d[0] = { ...d[0], fluorMask: '/work/too-yumm/01-fluor.webp' };
    d[1] = { ...d[1], fluorMask: '/work/too-yumm/02-fluor.webp' };
    return d;
  })(),
};

export default work;
