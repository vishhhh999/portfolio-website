import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWork, nextWork, works } from '@/content/work';
import { NextLink } from '@/components/ui/NextLink';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { ProofStrip } from '@/components/ui/ProofStrip';
import { SlugLine } from '@/components/ui/SlugLine';
import { SpecPlate } from '@/components/ui/SpecPlate';
import { JsonLd, workLd } from '@/lib/jsonld';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return works.map((w) => ({ slug: w.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const work = getWork((await params).slug);
  if (!work) return {};
  const description = work.description?.[0] ?? `${work.title}: ${work.disciplines.join(', ')}. ${work.object}.`;
  const image = { url: `/og/${work.slug}.jpg`, width: 1200, height: 630, alt: work.deliverables[0]?.alt ?? work.title };
  return {
    title: work.title,
    description,
    alternates: { canonical: `/work/${work.slug}` },
    openGraph: { type: 'article', url: `/work/${work.slug}`, title: `${work.title} · Vishesh Mahendru`, description, images: [image] },
    twitter: { card: 'summary_large_image', title: `${work.title} · Vishesh Mahendru`, description, images: [image.url] },
  };
}

export default async function WorkPage({ params }: Props) {
  const work = getWork((await params).slug);
  if (!work) notFound();
  const next = nextWork(work.slug);
  const index = works.indexOf(work) + 1;
  const serial = 40 + index * 6;

  return (
    <article className="work">
      <JsonLd data={workLd(work)} />
      {work.inLineup && <div className="work__stage" aria-hidden="true" />}
      <div className="work__body rail g12">
        <header className="work__head">
          <SlugLine id={serial} lamp={work.inLineup ? work.nativeLamp : 'ARCHIVE'} />
          <h1>{work.title}</h1>
          <p className="work__meta">
            {work.role} · {work.year}
          </p>
        </header>

        {/* work first: the opening deliverable sits straight under the title */}
        <ProofStrip deliverables={work.deliverables} serialBase={serial} part="hero" />

        <div className="work__intro g12">
          <SpecPlate work={work} serial={serial} />
          <div className="work__copy">
            {work.description?.length ? (
              <>
                {work.description.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}
                {work.sections?.map((sec) => (
                  <section key={sec.heading} className="work__section">
                    <h2>{sec.heading}</h2>
                    {sec.body.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}
                  </section>
                ))}
              </>
            ) : null}
            {work.uvNotes.length > 0 && (
              <section className="sr-only" aria-label="Proofer's notes, printed in UV ink">
                <h2>Proofer&apos;s notes (visible under the UV lamp)</h2>
                <ul>
                  {work.uvNotes.map((n) => (
                    <li key={n.text}>{n.text}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <ProofStrip deliverables={work.deliverables} serialBase={serial} part="rest" />

        <div className="work__links">
          {work.links?.map((l) => (
            <OutboundLink key={l.href} href={l.href} name={`${work.slug}: ${l.label}`} className="proofset">
              {l.label} ↗
            </OutboundLink>
          ))}
          <NextLink href={`/work/${next.slug}`}>
            <span className="mono">Next on the tray</span> {next.title} →
          </NextLink>
        </div>
      </div>
    </article>
  );
}
