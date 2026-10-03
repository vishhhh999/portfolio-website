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
  // UV notes: none until approved by Vishesh (drafts in content/uv-notes-draft.md)
  uvNotes: [],
  deliverables: placeholderDeliverables('jsw-sports', 'JSW Sports'),
};

export default work;
