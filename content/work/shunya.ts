import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'shunya',
  title: 'SHUNYA',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: false,
  nativeLamp: 'A',
  glb: '',
  object: 'Camphor jar and tin',
  fallbacks: placeholderFallbacks('shunya'),
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
  uvNotes: [],
  deliverables: placeholderDeliverables('shunya', 'SHUNYA'),
};

export default work;
