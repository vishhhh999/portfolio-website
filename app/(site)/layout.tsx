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
import { Notice } from '@/components/ui/Notice';
import { TorchOverlay } from '@/components/ui/TorchOverlay';
import { SiteNav } from '@/components/ui/SiteNav';
import { JsonLd, personLd } from '@/lib/jsonld';

/**
 * The Blender lightmap for the booth room (tools/booth-room.glb, TEXCOORD_1), if one has been
 * baked: decided at build time, so the client never requests a file that is not there.
 */
function boothLightmap(): string | null {
  // the KTX2 converted from Vishesh's bake (public/booth/lightmap.exr or .png, J) or an older location
  for (const rel of ['booth/lightmap.ktx2', 'booth/lightmap.png']) {
    if (existsSync(path.join(process.cwd(), 'public', rel))) return `/${rel}`;
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
        <SiteNav />
      </header>
      <SwitchPanel />
      <Shortcuts />
      <Loupe />
      <Notice />
      <TorchOverlay />
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
