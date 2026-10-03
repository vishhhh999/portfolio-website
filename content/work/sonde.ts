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
  inLineup: true,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Tablet with the product UI',
  fallbacks: placeholderFallbacks('sonde'),
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
  uvNotes: [],
  deliverables: placeholderDeliverables('sonde', 'Sonde'),
};

export default work;
