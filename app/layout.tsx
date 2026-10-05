import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

/**
 * Geist + Geist Mono, subset to the characters the site uses (tools/subset-fonts.sh: 141 KB → 50 KB),
 * preloaded, swapped in over metric-matched fallbacks so nothing shifts.
 */
const GeistSans = localFont({ src: './fonts/geist-sans-subset.woff2', variable: '--font-geist-sans', weight: '100 900', display: 'swap', preload: true, adjustFontFallback: 'Arial' });
const GeistMono = localFont({ src: './fonts/geist-mono-subset.woff2', variable: '--font-geist-mono', weight: '100 900', display: 'swap', preload: true, adjustFontFallback: false, fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] });

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
 * Runs before first paint: the visitor's lamp pick for this session is on <html data-lamp> before
 * anything renders, and a visitor who chose house lights gets every page's flat version from the first paint (B: a
 * mode, never a redirect).
 * Same keys as lib/store.ts. Only the visitor's own choices ever set them.
 */
const HOUSE_LIGHTS_BOOT = `(function(){try{var l=sessionStorage.getItem('vm:lamp:v1');if(l)document.documentElement.setAttribute('data-lamp',l);}catch(e){}try{if(localStorage.getItem('vm:houseLights:v2')==='1'||sessionStorage.getItem('vm:autoHouseLights:v1')==='1')document.documentElement.setAttribute('data-house-lights','');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HOUSE_LIGHTS_BOOT }} />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>
        {children}
        {/* H5: only where Vercel serves the insights script (a local or CI build would log a 404) */}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
