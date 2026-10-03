import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'indo-thai',
  title: 'Indo Thai',
  disciplines: ['Web', '3D'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: false,
  nativeLamp: 'SCREEN',
  glb: '',
  object: 'Laptop',
  fallbacks: placeholderFallbacks('indo-thai'),
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
  uvNotes: [],
  deliverables: placeholderDeliverables('indo-thai', 'Indo Thai'),
};

export default work;
