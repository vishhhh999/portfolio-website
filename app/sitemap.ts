import type { MetadataRoute } from 'next';
import { works } from '@/content/work';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    ...works.map((w) => ({ url: `${SITE_URL}/work/${w.slug}`, lastModified: now, changeFrequency: 'yearly' as const, priority: w.inLineup ? 0.8 : 0.6 })),
    { url: `${SITE_URL}/archive`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${SITE_URL}/house-lights`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
