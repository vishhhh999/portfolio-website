import { SOCIALS } from './site';
import type { Work } from '@/lib/types';
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from '@/lib/site';

/** JSON-LD script tag. Content is our own static data, serialised (no user input). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export const personLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${SITE_URL}/#person`,
  name: SITE_NAME,
  jobTitle: 'Visual designer',
  url: SITE_URL,
  email: `mailto:${CONTACT_EMAIL}`,
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
  knowsAbout: ['Brand identity', 'Packaging design', 'Editorial design', 'Web design', 'Product design', '3D visualization'],
  sameAs: SOCIALS.map((s) => s.href),
};

export function workLd(w: Work) {
  const first = w.deliverables[0];
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${SITE_URL}/work/${w.slug}#work`,
    name: w.title,
    url: `${SITE_URL}/work/${w.slug}`,
    creator: { '@id': `${SITE_URL}/#person` },
    dateCreated: String(w.year),
    description: w.description?.[0],
    genre: w.disciplines.join(', '),
    keywords: w.scope,
    image: `${SITE_URL}/og/${w.slug}.jpg`,
    ...(first ? { associatedMedia: { '@type': first.type === 'video' ? 'VideoObject' : 'ImageObject', contentUrl: `${SITE_URL}${first.src}`, description: first.alt } } : {}),
    ...(w.live ? { sameAs: w.live } : {}),
  };
}
