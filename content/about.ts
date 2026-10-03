/**
 * About page copy. From the live site's About page, with every client and brand name removed
 * (house rule: none anywhere in about copy) and the location kept to the country.
 *
 * Every `tbc` string is a PLACEHOLDER for Vishesh: it renders visibly marked on the page.
 */
export type Tbc = { tbc: string };
export const tbc = (note: string): Tbc => ({ tbc: note });
export type Copy = string | Tbc;

export const about = {
  name: 'Vishesh Mahendru',
  discipline: 'Visual designer',
  location: 'India',
  remote: 'Open to remote roles worldwide',
  /** What I do: the live site's own words, client and brand names taken out. */
  summary: [
    'Vishesh Mahendru is a visual designer based in India, working across brand identity, digital design, and 3D visualization.',
    'He’s spent the last few years moving between packaging, web, and spatial work, building brand systems that stay consistent whether they end up on a shelf, a screen, or somewhere in between. Recent work spans agency websites, sports branding, and packaging design for consumer brands, with 3D visualization used where it strengthens the work rather than as the whole point of it.',
  ] as Copy[],
  /** Certified illuminants: the disciplines, as on the spec plates. */
  disciplines: ['Brand identity', 'Packaging', 'Editorial', 'Web', 'Product UI', '3D visualization'],
  /** Experience: roles and years from the live site. Employer names are left out (they are brands). */
  experience: [
    { role: 'Visual Designer', years: '2026' },
    { role: 'Visual Design Intern', years: '2026' },
    { role: 'Graphic Designer', years: '2025' },
    { role: 'Branding & Visual Designer', where: 'Freelance', years: '2024' },
    { role: 'Web Designer & 3D Generalist', years: '2023' },
    { role: 'Graphic Design Intern', years: '2023' },
    { role: 'Apparel Designer', years: '2022' },
  ] as { role: string; where?: string; years: string }[],
  /** PLACEHOLDER: employers are left unnamed (they are brands). */
  experienceNote: tbc('Employers are unnamed on purpose. Add a generic descriptor per role if you want one (e.g. "studio").'),
  education: { degree: 'B.Des', school: tbc('School name: show it, or keep it off the page?'), years: '2022–2026' },
  award: { title: 'Gold, Best Creative Invite for a Wedding / Social Event', body: tbc('Award name and year: show it, or keep it off the page?') },
  /** PLACEHOLDER: a one-line personal statement in your own words, if you want one. */
  statement: tbc('Optional one-line statement in your own words.'),
};
