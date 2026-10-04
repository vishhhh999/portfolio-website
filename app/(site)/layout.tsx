import Link from 'next/link';
import { CONTACT_MAILTO, SOCIALS } from '@/lib/site';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { BoothHost } from '@/components/booth/BoothHost';
import { Providers } from '@/components/ui/Providers';
import { SwitchPanel } from '@/components/ui/SwitchPanel';
import { JsonLd, personLd } from '@/lib/jsonld';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <JsonLd data={personLd} />
      <BoothHost />
      <header className="masthead">
        <Link href="/" className="wordmark">Vishesh Mahendru</Link>
        <nav aria-label="Site" className="sitenav">
          <Link href="/house-lights">Index</Link>
          <Link href="/about">About</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </header>
      <SwitchPanel />
      <main id="main">{children}</main>
      <footer className="footer">
        <a href={CONTACT_MAILTO}>Book a viewing ↗</a>
        <CopyEmail />
        <nav className="footer__social" aria-label="Social">
          {SOCIALS.map((s) => (
            <OutboundLink key={s.label} href={s.href} name={s.label}>
              {s.label} ↗
            </OutboundLink>
          ))}
        </nav>
        <span className="mono footer__legal">© {new Date().getFullYear()} · India, working worldwide</span>
      </footer>
    </Providers>
  );
}
