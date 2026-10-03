import Link from 'next/link';
import { works } from '@/content/work';

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Tested under every light.</h1>
        <p>Brand and digital design by Vishesh Mahendru. India, working worldwide.</p>
      </section>
      {/* Crawlable, keyboard-reachable lineup. The canvas is presentational only. */}
      <nav aria-label="Work" className="sr-only">
        <ul>
          {works.map((w) => (
            <li key={w.slug}>
              <Link href={`/work/${w.slug}`}>{w.title}, {w.disciplines.join(', ')}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
