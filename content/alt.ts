/**
 * Alt text overrides, applied over the Framer import (which re-generates imported.ts).
 * Keyed by project slug, then 1-based deliverable position.
 * DRAFT: the videos had no alt on Framer; these are written from the footage and await
 * Vishesh's approval (content/alt-draft.md).
 */
export const ALT: Record<string, Record<number, string>> = {
  'house-of-hex': {
    1: 'House of Hex website playing on a desktop monitor on a desk washed in warm orange light, scrolling from the HOUSE OF HEX hero through a services page to the contact page.',
  },
  'indo-thai': {
    1: 'Indo Thai website on a laptop resting on lilac ridged steps, loading in and scrolling through a hero with a 3D aircraft render.',
  },
  mitooshi: {
    3: 'Mitooshi website on a tablet lying on a dark blue surface, moving from the hero (Strategic Infrastructure for Industry Leaders) through stat cards to the Join the network form.',
    5: 'A globe built from light blue ASCII dots, rotating on a bright blue square.',
    7: 'Clusters of light blue ASCII dot spheres shifting on a bright blue square.',
  },
  shunya: {
    1: 'A dark ceramic dish on a grey background: a camphor tablet catches a flame and burns down to nothing, while the SHUNYA wordmark (with शून्य below) appears and fades.',
  },
};
