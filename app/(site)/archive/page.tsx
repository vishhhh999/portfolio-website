import type { Metadata } from 'next';
import { Suspense } from 'react';
import { archivePieces } from '@/content/archive';
import { ArchiveGrid, ArchiveView } from '@/components/ui/ArchiveGrid';

export const metadata: Metadata = {
  title: 'Archive',
  description: 'Experiments, explorations and freelance work by Vishesh Mahendru, outside the main case studies.',
  alternates: { canonical: '/archive' },
};

/** Contact sheet under D50: plain DOM, no WebGL. */
export default function ArchivePage() {
  return (
    <section className="page archive-page">
      <p className="mono">Contact sheet · D50 · {archivePieces.length} pieces</p>
      <h1>Archive</h1>
      <p className="archive__intro">Experiments, explorations and freelance work outside the main case studies.</p>
      <Suspense fallback={<ArchiveView pieces={archivePieces} />}>
        <ArchiveGrid pieces={archivePieces} />
      </Suspense>
    </section>
  );
}
