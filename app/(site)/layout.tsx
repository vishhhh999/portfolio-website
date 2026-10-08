import { existsSync } from 'fs';
import path from 'path';
import Link from 'next/link';
import { CONTACT_EMAIL, SOCIALS, contactMailto } from '@/lib/site';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { BoothHost } from '@/components/booth/BoothHost';
import type { BoothLightmap } from '@/components/booth/BoothRoom';
import { Providers } from '@/components/ui/Providers';
import { SwitchPanel } from '@/components/ui/SwitchPanel';
import { Shortcuts } from '@/components/ui/Shortcuts';
import { Loupe } from '@/components/ui/Loupe';
import { Notice } from '@/components/ui/Notice';
import { TorchOverlay } from '@/components/ui/TorchOverlay';
import { SiteNav } from '@/components/ui/SiteNav';
import { CursorLabel } from '@/components/ui/CursorLabel';
import { Reveal } from '@/components/ui/Reveal';
import { IstClock } from '@/components/ui/AboutBits';
import { JsonLd, personLd } from '@/lib/jsonld';

/**
 * The Blender lightmap for the booth room (tools/booth-room.glb, TEXCOORD_1), if one has been
 * baked: decided at build time, so the client never requests a file that is not there. C1 (09):
 * desktop the KTX2, phones the small WebP (tools/encode-lightmap.mjs); the 16-bit PNG and the EXR
 * are sources under assets-src/booth and never served.
 */
function boothLightmap(): BoothLightmap | null {
  const has = (rel: string) => existsSync(path.join(process.cwd(), 'public', rel));
  const out = { desktop: has('booth/lightmap.ktx2') ? '/booth/lightmap.ktx2' : null, phone: has('booth/lightmap-phone.webp') ? '/booth/lightmap-phone.webp' : null };
  return out.desktop || out.phone ? out : null;
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <JsonLd data={personLd} />
      <BoothHost lightmap={boothLightmap()} />
      {/* P8 (09): the first stop for a keyboard: straight past the booth and the nav to the content */}
      <a className="skiplink" href="#main">Skip to content</a>
      <header className="masthead">
        <Link href="/" className="wordmark">Vishesh Mahendru</Link>
        {/* L1 (09B): on a phone held sideways the home headline joins this row (the h1 stays in the page) */}
        <span className="masthead__tagline mono" aria-hidden="true">Tested under every light.</span>
        <SiteNav />
      </header>
      <SwitchPanel />
      <Shortcuts />
      <Loupe />
      <Notice />
      <TorchOverlay />
      <CursorLabel />
      <Reveal />
      <main id="main" tabIndex={-1}>{children}</main>
      {/* M3 (09): every page ends on the closing call to action: the email large (it opens the
          visitor's own mail app with a message ready, M5), a copy button, the time in India, socials */}
      <footer className="footer">
        <section className="closing" aria-labelledby="closing-title">
          <p className="mono closing__kicker" id="closing-title">Book a viewing</p>
          <a className="closing__email" href={contactMailto()}>
            {CONTACT_EMAIL}
          </a>
          <div className="closing__row">
            <CopyEmail />
            <span className="closing__time mono">
              India <IstClock />
            </span>
          </div>
          <nav className="footer__social" aria-label="Social">
            {SOCIALS.map((s) => (
              <OutboundLink key={s.label} href={s.href} name={s.label}>
                {s.label} ↗
              </OutboundLink>
            ))}
          </nav>
        </section>
        <span className="mono footer__legal">© {new Date().getFullYear()} · India, working worldwide</span>
      </footer>
    </Providers>
  );
}
