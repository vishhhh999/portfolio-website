import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

// TODO(vish): confirm year, role, scope, Behance URL.
const work: Work = {
  slug: 'bengal-t20',
  title: 'Bengal T20 League',
  disciplines: ['Brand identity', 'Sport'],
  year: 2025,
  role: 'TBC',
  scope: 'TBC',
  inLineup: true,
  nativeLamp: 'FLOOD',
  glb: '',
  object: 'Folded flag, match ticket and jersey swatch stack',
  fallbacks: placeholderFallbacks('bengal-t20'),
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
  uvNotes: [],
  deliverables: placeholderDeliverables('bengal-t20', 'Bengal T20 League'),
};

export default work;
