import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import { avifFor } from '@/content/masters';
import { sizedFile, srcSetFor } from '@/lib/responsive';
import { getWork, lineup, nextWork, prevWork, works } from '@/content/work';
import { lampById } from '@/lib/lampPresets';
import { WorkStage } from '@/components/booth/Booth';
import { Proofs } from '@/components/ui/Proofs';
import { UvCaption } from '@/components/ui/UvCaption';
import { LiveLink } from '@/components/ui/LiveLink';
import { NativeLampChip } from '@/components/ui/NativeLampChip';
import { Cover } from '@/components/ui/Cover';
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
  const prev = prevWork(work.slug);
  const first = work.deliverables[0];
  const firstSet = first && first.type === 'image' ? srcSetFor(first.src, 'avif') : null;
  if (firstSet) preload(first!.src.replace(/\.webp$/, '.avif'), { as: 'image', type: 'image/avif', imageSrcSet: firstSet, imageSizes: '(max-width: 760px) 100vw, min(92vw, 1600px)' });
  else if (first) {
    const one = first.type === 'video' ? first.poster && sizedFile(first.poster, 1200) : avifFor(first.src) ?? first.src;
    if (one) preload(one, { as: 'image' });
  }
  const index = lineup.findIndex((w) => w.slug === work.slug) + 1;
  const serial = 40 + (works.indexOf(work) + 1) * 6;
  const [lead, ...rest] = work.description ?? [];
  const spec: [string, string][] = [
    ['Client', work.clientType ?? ''],
    ['Role', work.role],
    ['Year', String(work.year)],
    ['Scope', work.scope],
    ['Disciplines', work.disciplines.join(', ')],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article className="work">
      <JsonLd data={workLd(work)} />
      {work.inLineup && <WorkStage slug={work.slug} />}
      <div className="work__body">
        <header className="work__intro" data-reveal="">
          <div className="work__heading">
            <p className="work__eyebrow data">{work.inLineup ? `${String(index).padStart(2, '0')} / ${String(lineup.length).padStart(2, '0')}` : 'Archive'}</p>
            <h1 className="work__title">{work.title}</h1>
            {lead && <p className="work__lead">{lead}</p>}
          </div>
          <aside className="work__spec" aria-label="Project details">
            <dl>
              {spec.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {work.inLineup && (
                <div>
                  <dt>Native lamp</dt>
                  <dd>{lampById(work.nativeLamp).label}</dd>
                </div>
              )}
            </dl>
            <div className="work__actions">
              {work.links?.length ? <LiveLink work={work} where="label" /> : null}
              {work.inLineup && work.nativeLamp !== 'D50' && <NativeLampChip lamp={work.nativeLamp} />}
            </div>
          </aside>
        </header>

        <Proofs deliverables={work.deliverables} serialBase={serial} items={[0]} label="Opening image" />
        <UvCaption notes={work.uvNotes.map((n) => n.text)} />

        {rest.length > 0 && (
          <div className="work__copy" data-reveal="">
            {rest.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}
          </div>
        )}
        <Proofs deliverables={work.deliverables} serialBase={serial} items={[1, 2]} label="Images 2 and 3" />
        {(work.sections ?? []).map((sec) => (
          <section key={sec.heading} className="work__copy" data-reveal="">
            <h2>{sec.heading}</h2>
            {sec.body.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}
          </section>
        ))}
        <Proofs deliverables={work.deliverables} serialBase={serial} items={work.deliverables.map((_, i) => i).slice(3)} label="More images" />
        {work.uvNotes.length > 0 && (
          <section className="sr-only" aria-label="Proofer's notes, printed in UV ink">
            <h2>Proofer&apos;s notes (visible under the UV lamp)</h2>
            <ul>
              {work.uvNotes.map((n) => <li key={n.text}>{n.text}</li>)}
            </ul>
          </section>
        )}
        {work.links?.length ? (
          <p className="work__end-link" data-reveal="">
            <LiveLink work={work} where="end" />
          </p>
        ) : null}
      </div>

      <nav className="pager" aria-label="More projects" data-reveal="">
        {[
          { w: prev, dir: 'Previous' },
          { w: next, dir: 'Next' },
        ].map(({ w, dir }) => (
          <Link key={dir} href={`/work/${w.slug}`} className={`pager__item pager__item--${dir.toLowerCase()}`}>
            <Cover slug={w.slug} className="pager__cover" sizes="(max-width: 760px) 30vw, 160px" />
            <span className="pager__text">
              <span className="pager__dir">{dir}</span>
              <span className="pager__title">{w.title}</span>
              <span className="pager__tags">{w.disciplines.join(', ')}</span>
            </span>
          </Link>
        ))}
      </nav>
    </article>
  );
}
