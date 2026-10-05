import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

/**
 * H6 (08): the web manifest as a plain route, so the layout links it itself with
 * crossOrigin="use-credentials" everywhere (Next's file convention only adds that on Vercel
 * previews; behind deployment protection the fetch otherwise fails with a 401 in the console).
 */
export const dynamic = 'force-static';

export function GET() {
  const manifest: MetadataRoute.Manifest = {
    name: `${SITE_NAME} · Tested under every light`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#F2F0EA',
    theme_color: '#1B1B1A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json' } });
}
