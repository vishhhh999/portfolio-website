import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.visheshmahendru.com'),
  title: { default: 'Vishesh Mahendru · Tested under every light', template: '%s · Vishesh Mahendru' },
  description: 'Brand and digital design by Vishesh Mahendru. India, working worldwide.',
};

export const viewport: Viewport = { themeColor: '#A8A8A6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
