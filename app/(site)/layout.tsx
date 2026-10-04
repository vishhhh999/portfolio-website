import { existsSync } from 'fs';
import path from 'path';
import Link from 'next/link';
import { CONTACT_MAILTO, SOCIALS } from '@/lib/site';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { BoothHost } from '@/components/booth/BoothHost';
import { Providers } from '@/components/ui/Providers';
import { SwitchPanel } from '@/components/ui/SwitchPanel';
import { Shortcuts } from '@/components/ui/Shortcuts';
import { Loupe } from '@/components/ui/Loupe';
import { JsonLd, personLd } from '@/lib/jsonld';

/**
 * The Blender lightmap for the booth shell (tools/booth-shell.glb, TEXCOORD_1), if one has been
 * baked: decided at build time, so the client never requests a file that is not there.
 */
function boothLightmap(): string | null {
  for (const name of ['lightmap.ktx2', 'lightmap.png']) {
    if (existsSync(path.join(process.cwd(), 'public/models/booth-shell', name))) return `/models/booth-shell/${name}`;
  }
  return null;
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <JsonLd data={personLd} />
      <BoothHost lightmap={boothLightmap()} />
      <header className="masthead">
        <Link href="/" className="wordmark">Vishesh Mahendru</Link>
        <nav aria-label="Site" className="sitenav">
          <Link href="/house-lights">Index</Link>
          <Link href="/about">About</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </header>
      <SwitchPanel />
      <Shortcuts />
      <Loupe />
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
