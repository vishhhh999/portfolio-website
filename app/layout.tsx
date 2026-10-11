import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

/**
 * Geist + Geist Mono, subset to the characters the site uses (tools/subset-fonts.sh: 141 KB → 50 KB),
 * preloaded, swapped in over metric-matched fallbacks so nothing shifts.
 */
const GeistSans = localFont({ src: './fonts/geist-sans-subset.woff2', variable: '--font-geist-sans', weight: '100 900', display: 'swap', preload: true, adjustFontFallback: 'Arial' });
/** The display face: Instrument Serif (direction A) or Bricolage Grotesque (direction B), both SIL Open Font License. */
const DisplaySerif = localFont({ src: [{ path: './fonts/instrument-serif.woff2', style: 'normal' }, { path: './fonts/instrument-serif-italic.woff2', style: 'italic' }], variable: '--font-display-serif', weight: '400', display: 'swap', preload: true, adjustFontFallback: 'Times New Roman' });
const DisplayGrotesk = localFont({ src: './fonts/bricolage-grotesque.woff2', variable: '--font-display-grotesk', weight: '200 800', display: 'swap', preload: false, adjustFontFallback: 'Arial' });
const GeistMono = localFont({ src: './fonts/geist-mono-subset.woff2', variable: '--font-geist-mono', weight: '100 900', display: 'swap', preload: true, adjustFontFallback: false, fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] });

export const metadata: Metadata = {
  // M1 (09): on a Vercel preview, OG and canonical URLs resolve on that preview (so the share cards can be
  // checked there); production always uses the real domain
  metadataBase: new URL(process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : 'https://www.visheshmahendru.com'),
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

export const viewport: Viewport = { themeColor: '#F2F0EA', viewportFit: 'cover' };

/**
 * Runs before first paint: the visitor's lamp for this session on <html data-lamp>, house lights on
 * <html data-house-lights> if the visitor chose it (a mode, never a redirect). Same keys as lib/store.ts.
 * `?type=serif|grotesk` previews a display face.
 */
const BOOT = `(function(){var d=document.documentElement;try{var l=sessionStorage.getItem('vm:lamp:v1');if(l)d.setAttribute('data-lamp',l);}catch(e){}try{if(localStorage.getItem('vm:houseLights:v2')==='1'||sessionStorage.getItem('vm:autoHouseLights:v1')==='1')d.setAttribute('data-house-lights','');}catch(e){}try{var t=new URLSearchParams(location.search).get('type');if(t==='serif'||t==='grotesk')d.setAttribute('data-type',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${DisplaySerif.variable} ${DisplayGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
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
