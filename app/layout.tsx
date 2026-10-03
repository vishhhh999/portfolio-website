import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.visheshmahendru.com'),
  title: { default: 'Vishesh Mahendru · Tested under every light', template: '%s · Vishesh Mahendru' },
  description: 'Brand and digital design by Vishesh Mahendru. India, working worldwide.',
  applicationName: 'Vishesh Mahendru',
  authors: [{ name: 'Vishesh Mahendru', url: 'https://www.visheshmahendru.com' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Vishesh Mahendru',
    url: '/',
    title: 'Vishesh Mahendru · Tested under every light',
    description: 'Brand and digital design by Vishesh Mahendru. India, working worldwide.',
    images: [{ url: '/og/site.jpg', width: 1200, height: 630, alt: 'The viewing booth: a lineup of design work under daylight.' }],
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vishesh Mahendru · Tested under every light',
    description: 'Brand and digital design by Vishesh Mahendru. India, working worldwide.',
    images: ['/og/site.jpg'],
  },
};

export const viewport: Viewport = { themeColor: '#A8A8A6' };

/**
 * Runs before first paint: a visitor who chose house lights never sees the booth flash on /.
 * Same key as lib/store.ts. Only the visitor's own toggle ever sets it.
 */
const HOUSE_LIGHTS_BOOT = `(function(){try{if(location.pathname==='/'&&localStorage.getItem('vm:houseLights:v2')==='1'){document.documentElement.setAttribute('data-house-lights-redirect','');location.replace('/house-lights'+location.search+location.hash);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HOUSE_LIGHTS_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
