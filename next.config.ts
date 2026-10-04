import type { NextConfig } from 'next';

/** Live-site /projects/<slug> → /work/<slug>. */
export const LEGACY_PROJECTS: Record<string, string> = {
  'too-yumm': 'too-yumm',
  mitooshi: 'mitooshi',
  'bengal-t20-league': 'bengal-t20',
  'house-of-hex': 'house-of-hex',
  indothai: 'indo-thai',
  shunya: 'shunya',
  sonde: 'sonde',
  sook: 'sook',
  'jsw-sports': 'jsw-sports',
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // House lights used to live at /index. Never use "index" as a route segment: Vercel's CDN serves
  // /index (and /index.rsc) from the root page's index.html, so the page rendered as the home hero.
  //
  // The live Framer site used /projects/<slug>; those URLs are in job applications. 301 each one to
  // its booth page (statusCode, not `permanent`, which sends 308).
  async redirects() {
    return [
      { source: '/index', destination: '/house-lights', permanent: true },
      ...Object.entries(LEGACY_PROJECTS).map(([from, to]) => ({ source: `/projects/${from}`, destination: `/work/${to}`, statusCode: 301 as const })),
    ];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'media.visheshmahendru.com' }],
  },
};

export default nextConfig;
