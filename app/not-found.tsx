import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Sample not found', robots: { index: false } };

/**
 * 404 (I3): the booth under UV, an empty plinth where the sample should stand, the copy glowing like
 * fluorescent ink. Pure CSS (no WebGL): instant, and nothing shifts while it loads. A visitor who
 * chose house lights gets the plain version (the pre-paint script marks <html data-house-lights>).
 */
export default function NotFound() {
  return (
    <main className="nf">
      <section className="nf__booth" aria-hidden="true">
        <div className="nf__hood" />
        <div className="nf__room">
          <div className="nf__plinth">
            <span className="nf__top" />
            <span className="nf__face" />
          </div>
          <div className="nf__floor" />
        </div>
        <div className="nf__sill">
          <span className="mono">VM VIEWING BOOTH · UV-A · 365NM</span>
        </div>
      </section>
      <div className="nf__copy">
        <p className="mono nf__code">404 · UV-A</p>
        <h1>Sample not found.</h1>
        <p>Nothing on this plinth, under any light.</p>
        <p className="nf__links">
          <Link href="/">Back to the booth →</Link>
          <Link href="/house-lights">The index →</Link>
        </p>
      </div>
    </main>
  );
}
