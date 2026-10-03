import type { Metadata } from 'next';
import Link from 'next/link';
import { archive } from '@/content/work';

export const metadata: Metadata = { title: 'Archive', description: 'Contact sheet of secondary work by Vishesh Mahendru.' };

/** Contact sheet under D50. Full lightbox, video and in-booth 3D viewer in Phase 5. */
export default function ArchivePage() {
  return (
    <section className="page">
      <p className="mono">Contact sheet · D50</p>
      <h1>Archive</h1>
      <ol className="archive-list">
        {archive.map((w, i) => (
          <li key={w.slug}>
            <Link href={`/work/${w.slug}`}>
              <span className="archive-list__frame">{w.object}</span>
              <span className="mono">A{String(i + 1).padStart(2, '0')} · {w.disciplines.join(' · ')} · {w.year}</span>
              <span className="archive-list__title">{w.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
