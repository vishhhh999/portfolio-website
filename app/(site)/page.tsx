import Link from 'next/link';
import { lineup } from '@/content/work';
import { BoothFrame } from '@/components/booth/BoothFrame';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <h1>Tested under every light.</h1>
          <p>Brand and digital design by Vishesh Mahendru. India, working worldwide.</p>
        </div>
        {/* the viewing booth sits here, as an object on the page */}
        <BoothFrame />
      </section>
      {/* Crawlable, keyboard-reachable lineup. The canvas is presentational only. */}
      <nav aria-label="Work" className="sr-only">
        <ul>
          {lineup.map((w) => (
            <li key={w.slug}>
              <Link href={`/work/${w.slug}`}>{w.title}, {w.disciplines.join(', ')}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
