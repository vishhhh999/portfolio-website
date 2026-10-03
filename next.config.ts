import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // House lights used to live at /index. Never use "index" as a route segment: Vercel's CDN serves
  // /index (and /index.rsc) from the root page's index.html, so the page rendered as the home hero.
  async redirects() {
    return [{ source: '/index', destination: '/house-lights', permanent: true }];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'media.visheshmahendru.com' }],
  },
};

export default nextConfig;
