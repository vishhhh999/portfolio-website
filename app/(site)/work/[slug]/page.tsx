import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWork, nextWork, works } from '@/content/work';
import { NextLink } from '@/components/ui/NextLink';
import { ProofStrip } from '@/components/ui/ProofStrip';
import { SlugLine } from '@/components/ui/SlugLine';
import { SpecPlate } from '@/components/ui/SpecPlate';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return works.map((w) => ({ slug: w.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const work = getWork((await params).slug);
  if (!work) return {};
  return { title: work.title, description: work.description?.[0] ?? `${work.title}: ${work.disciplines.join(', ')}. ${work.object}.` };
}

export default async function WorkPage({ params }: Props) {
  const work = getWork((await params).slug);
  if (!work) notFound();
  const next = nextWork(work.slug);
  const index = works.indexOf(work) + 1;
  const serial = 40 + index * 6;

  return (
    <article className="work">
      {work.inLineup && <div className="work__stage" aria-hidden="true" />}
      <div className="work__body">
        <SlugLine id={serial} lamp={work.inLineup ? work.nativeLamp : 'ARCHIVE'} />
        <h1>{work.title}</h1>

        <div className="work__intro">
          <SpecPlate work={work} serial={serial} />
          <div className="work__copy">
            {work.description?.length ? (
              work.description.map((p) => <p key={p.slice(0, 32)}>{p}</p>)
            ) : (
              <p className="work__tbc">Case copy imports from the live site (TBC).</p>
            )}
          </div>
        </div>

        {/* UV annotations, readable without WebGL. */}
        <section className="sr-only" aria-label="Design notes">
          <ul>{work.uvNotes.map((n) => <li key={n.text}>{n.text}</li>)}</ul>
        </section>

        <ProofStrip deliverables={work.deliverables} serialBase={serial} />

        <div className="work__links">
          {work.behance ? (
            <a href={work.behance} target="_blank" rel="noreferrer" className="proofset">Full proof set ↗</a>
          ) : (
            <span className="proofset proofset--tbc">Full proof set ↗ · link TBC</span>
          )}
          <NextLink href={`/work/${next.slug}`}>
            <span className="mono">Next on the tray</span> {next.title} →
          </NextLink>
        </div>
      </div>
    </article>
  );
}
