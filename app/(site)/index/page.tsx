import type { Metadata } from 'next';
import Link from 'next/link';
import { works } from '@/content/work';

export const metadata: Metadata = {
  title: 'Index',
  description: 'Every project by Vishesh Mahendru, house lights on.',
};

/** House lights: flat, fast, no WebGL. */
export default function IndexPage() {
  return (
    <section className="houselights">
      <header className="houselights__head">
        <h1>House lights on.</h1>
        <p className="mono">{works.length} projects · booth off · press I to switch it back on</p>
      </header>
      <ol className="index">
        <li className="index__legend mono" aria-hidden="true">
          <span>No.</span><span>Project</span><span>Object in booth</span><span>Disciplines</span><span>Year</span>
        </li>
        {works.map((w, i) => (
          <li key={w.slug}>
            <Link href={`/work/${w.slug}`}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="index__title">{w.title}</span>
              <span className="index__object">{w.object}</span>
              <span className="index__tags">{w.disciplines.join(' · ')}</span>
              <span className="mono">{w.year}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
