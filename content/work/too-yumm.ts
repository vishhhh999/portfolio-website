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
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
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
