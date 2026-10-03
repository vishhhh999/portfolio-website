import type { Metadata } from 'next';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site';

export const metadata: Metadata = { title: 'About', description: 'Certificate of Calibration: Vishesh Mahendru.' };

/** The calibration certificate. Built out in Phase 5. */
export default function AboutPage() {
  return (
    <section className="page">
      <p className="mono">Certificate of Calibration</p>
      <h1>Vishesh Mahendru</h1>
      <p>Certified illuminants: brand identity, packaging, editorial, web, product UI, 3D.</p>
      <p>
        Book a viewing: <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
      </p>
    </section>
  );
}
