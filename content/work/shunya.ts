import type { Work } from '@/lib/types';
import { placeholderDeliverables, placeholderFallbacks } from './_placeholder';

const work: Work = {
  slug: 'shunya',
  title: 'SHUNYA',
  disciplines: ['Packaging', 'Brand'],
  year: 2025,
  role: '',
  scope: '',
  inLineup: true,
  nativeLamp: 'A',
  glb: '',
  model: {
    src: '/models/shunya/shunya.glb',
    mobile: '/models/shunya/shunya.mobile.glb',
    // F3: one row as seen from the booth's camera: the Ritual Set's lid, the glass jar and the Air
    // tin each in clear view (the tin is low, in front of the set; the jar to its right)
    layout: {
      // H3 (09): every piece at least 2mm clear of the others (tools/mesh-clearance.mjs, in check-sizes)
      shunya_ritual_set: [-0.06, -0.035, 0.12],
      shunya_pooja_carton: [-0.21, 0.03, 0.25],
      shunya_bhimseni_jar: [0.13, -0.02, 0],
      shunya_air_tin: [0.0, 0.095, 0],
    },
  },
  object: 'The SHUNYA range: Ritual Set, Bhimseni jar, Air tin and Pooja carton',
  fallbacks: placeholderFallbacks('shunya'),
  // UV notes: the approved set is applied in corrections.ts
  uvNotes: [],
  deliverables: placeholderDeliverables('shunya', 'SHUNYA'),
};

export default work;
