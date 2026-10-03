import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'sonde',
  title: 'Sonde',
  disciplines: ['Product UI', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Tablet with the product UI',
  fallbacks: placeholderFallbacks('sonde'),
  uvNotes: [
    { text: 'Component logic: one card, five states', anchor: [0, 0.1, 0.01] },
    { text: 'Violet only marks where Sonde is looking', anchor: [0, 0.06, 0.01] },
    { text: '8pt grid, 12-col dashboard layout', anchor: [-0.08, 0.12, 0.01] },
  ],
  deliverables: placeholderDeliverables('sonde', 'Sonde'),
};

export default work;
