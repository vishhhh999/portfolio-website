/**
 * About page content. Everything here matches the live site (www.visheshmahendru.com/about),
 * verbatim where it is copy: the summary, experience, education, award, tools and clients.
 */
export const about = {
  name: 'Vishesh Mahendru',
  discipline: 'Visual designer',
  location: 'India',
  /** What I do: the live site's own words. */
  summary: [
    'Vishesh Mahendru is a visual designer based in India, working across brand identity, digital design, and 3D visualization.',
    'He’s spent the last few years moving between packaging, web, and spatial work, building brand systems that stay consistent whether they end up on a shelf, a screen, or somewhere in between. Recent work spans agency websites, sports branding, and packaging design for consumer brands, with 3D visualization used where it strengthens the work rather than as the whole point of it.',
  ],
  /** Certified illuminants: the disciplines, as on the spec plates. */
  disciplines: ['Brand identity', 'Packaging', 'Editorial', 'Web', 'Product UI', '3D visualization'],
  /** Experience, newest first, exactly as on the live site. */
  experience: [
    { role: 'Visual Designer', where: 'House of Hex', years: '2026' },
    { role: 'Visual Design Intern', where: 'BHONG', years: '2026' },
    { role: 'Graphic Designer', where: 'Vast.gg', years: '2025' },
    { role: 'Branding & Visual Designer', where: 'Freelance', years: '2024' },
    { role: 'Web Designer & 3D Generalist', where: 'The Graphē', years: '2024' },
    { role: 'Graphic Design Intern', where: 'The Graphē', years: '2023' },
    { role: 'Apparel Designer', where: 'Bonkers Corner', years: '2022' },
    { role: 'Branding & Visual Designer', where: 'Freelance', years: '2022' },
  ],
  education: { degree: 'B.Des', school: 'École Intuit Lab', years: '2022–2026' },
  award: { level: 'Gold', name: 'WOW Awards Asia', year: '2024', category: 'Best Creative Invite for a Wedding / Social Event' },
  tools: ['Adobe Creative Suite', 'Figma', 'Framer', 'Blender 3D', 'Notion', 'Claude'],
  /** All 16, in the live site's order. */
  clients: [
    'AMD',
    'Western Digital',
    'True Rippers Esports',
    'Bonkers Corner',
    'Win Pens',
    'Indo Thai',
    'Vast.gg',
    'Poggers',
    'IABA',
    'Momo La',
    'NY Pizza Co.',
    'BHONG',
    'Batovi Vodka',
    'Mitooshi',
    'JSW Sports',
    'SOOK',
  ],
  portrait: { src: '/about/portrait.webp', avif: '/about/portrait.avif', width: 1254, height: 1254, alt: 'Portrait of Vishesh Mahendru' },
  cv: '/Vishesh-Mahendru-CV.pdf',
};
