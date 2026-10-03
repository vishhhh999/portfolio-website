import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWork, nextWork, works } from '@/content/work';
import { SlugLine } from '@/components/ui/SlugLine';
import { lampById } from '@/lib/lampPresets';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return works.map((w) => ({ slug: w.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const work = getWork((await params).slug);
  if (!work) return {};
  return { title: work.title, description: `${work.title}: ${work.disciplines.join(', ')}. ${work.object}.` };
}

export default async function WorkPage({ params }: Props) {
  const work = getWork((await params).slug);
  if (!work) notFound();
  const next = nextWork(work.slug);
  const index = works.indexOf(work) + 1;

  return (
    <article className="work">
      {work.inLineup && <div className="work__stage" aria-hidden="true" />}
      <div className="work__body">
        <SlugLine id={index} lamp={work.inLineup ? work.nativeLamp : 'ARCHIVE'} />
        <h1>{work.title}</h1>

        {/* Spec plate: styled as a calibration label in Phase 5. */}
        <dl className="specplate">
          <div><dt>Disciplines</dt><dd>{work.disciplines.join(' · ')}</dd></div>
          <div><dt>Role</dt><dd>{work.role}</dd></div>
          <div><dt>Year</dt><dd>{work.year}</dd></div>
          <div><dt>Scope</dt><dd>{work.scope}</dd></div>
          <div><dt>Native lamp</dt><dd>{lampById(work.nativeLamp).label}</dd></div>
        </dl>

        {/* UV annotations, readable without WebGL. */}
        <section className="sr-only" aria-label="Design notes">
          <ul>{work.uvNotes.map((n) => <li key={n.text}>{n.text}</li>)}</ul>
        </section>

        {/* Proof strip: 6 deliverables. Real media + crop marks in Phase 5. */}
        <ol className="proofstrip">
          {work.deliverables.map((d, i) => (
            <li key={d.src} className="proofstrip__frame">
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="proofstrip__ph">{d.alt}</span>
            </li>
          ))}
        </ol>

        {work.behance && (
          <a href={work.behance} target="_blank" rel="noreferrer">Full proof set ↗</a>
        )}

        <Link href={`/work/${next.slug}`} scroll={false} className="next">
          <span className="mono">Next on the tray</span> {next.title} →
        </Link>
      </div>
    </article>
  );
}
