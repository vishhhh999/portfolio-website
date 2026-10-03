import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Archive', description: 'Contact sheet of secondary work by Vishesh Mahendru.' };

/** Contact sheet under D50. Built out in Phase 5. */
export default function ArchivePage() {
  return (
    <section className="page">
      <p className="mono">Contact sheet · D50</p>
      <h1>Archive</h1>
    </section>
  );
}
