import Link from 'next/link';
import { CONTACT_EMAIL, SOCIALS, contactMailto } from '@/lib/site';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { BoothLayer } from '@/components/booth/Booth';
import { Providers } from '@/components/ui/Providers';
import { LampPanel } from '@/components/ui/LampPanel';
import { Shortcuts } from '@/components/ui/Shortcuts';
import { Notice } from '@/components/ui/Notice';
import { TorchOverlay } from '@/components/ui/TorchOverlay';
import { SiteNav } from '@/components/ui/SiteNav';
import { Reveal } from '@/components/ui/Reveal';
import { IstClock } from '@/components/ui/AboutBits';
import { JsonLd, personLd } from '@/lib/jsonld';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <JsonLd data={personLd} />
      <BoothLayer />
      <a className="skiplink" href="#main">Skip to content</a>
      <header className="masthead">
        <Link href="/" className="wordmark">Vishesh Mahendru</Link>
        <SiteNav />
      </header>
      <LampPanel />
      <Shortcuts />
      <Notice />
      <TorchOverlay />
      <Reveal />
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="footer">
        <div className="footer__inner">
          <p className="footer__kicker">Book a viewing</p>
          <a className="footer__email" href={contactMailto()}>{CONTACT_EMAIL}</a>
          <div className="footer__row">
            <CopyEmail />
            <span className="footer__time">India <IstClock /></span>
            <nav className="footer__social" aria-label="Social">
              {SOCIALS.map((s) => (
                <OutboundLink key={s.label} href={s.href} name={s.label}>
                  {s.label}
                </OutboundLink>
              ))}
            </nav>
          </div>
          <p className="footer__legal">© {new Date().getFullYear()} Vishesh Mahendru · India, working worldwide</p>
        </div>
      </footer>
    </Providers>
  );
}
