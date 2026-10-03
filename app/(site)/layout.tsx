import Link from 'next/link';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site';
import { BoothHost } from '@/components/booth/BoothHost';
import { Providers } from '@/components/ui/Providers';
import { SwitchPanel } from '@/components/ui/SwitchPanel';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <BoothHost />
      <header className="masthead">
        <Link href="/" className="wordmark">Vishesh Mahendru</Link>
        <nav aria-label="Site" className="sitenav">
          <Link href="/index">Index</Link>
          <Link href="/about">About</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </header>
      <SwitchPanel />
      <main id="main">{children}</main>
      <footer className="footer">
        <a href={CONTACT_MAILTO}>Book a viewing ↗</a>
        <span className="mono">{CONTACT_EMAIL}</span>
        <span className="mono footer__legal">© {new Date().getFullYear()} · India, working worldwide</span>
      </footer>
    </Providers>
  );
}
