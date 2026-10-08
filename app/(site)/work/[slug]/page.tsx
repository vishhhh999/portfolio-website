import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import { avifFor } from '@/content/masters';
import { sizedFile, srcSetFor } from '@/lib/responsive';
import { getWork, nextWork, prevWork, works } from '@/content/work';
import { NextLink } from '@/components/ui/NextLink';
import { ProofStrip } from '@/components/ui/ProofStrip';
import { SlugLine } from '@/components/ui/SlugLine';
import { SpecPlate } from '@/components/ui/SpecPlate';
import { UvCaption } from '@/components/ui/UvCaption';
import { TrayTurn } from '@/components/ui/TrayTurn';
import { LiveLink } from '@/components/ui/LiveLink';
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
  // the first proof is the page's largest paint: fetch it first (AVIF where a master exists)
  const first = work.deliverables[0];
  // H5: preload the sized set the <picture> will actually pick (srcset + sizes), so phones never
  // preload a file they then do not use
  const firstSet = first && first.type === 'image' ? srcSetFor(first.src, 'avif') : null;
  if (firstSet) preload(first!.src.replace(/\.webp$/, '.avif'), { as: 'image', fetchPriority: 'high', type: 'image/avif', imageSrcSet: firstSet, imageSizes: '(max-width: 760px) 100vw, min(70vw, 1400px)' });
  else if (first) {
    const one = first.type === 'video' ? first.poster && sizedFile(first.poster, 1200) : avifFor(first.src) ?? first.src;
    if (one) preload(one, { as: 'image', fetchPriority: 'high' });
  }
  const index = works.indexOf(work) + 1;
  const serial = 40 + index * 6;

  const sections = work.sections ?? [];
  const more = work.deliverables.map((_, i) => i).slice(3);

  return (
    <article className="work">
      <JsonLd data={workLd(work)} />
      {work.inLineup && (
        <div className="work__stage">
          <TrayTurn slug={work.slug} title={work.title} />
        </div>
      )}
      <div className="work__body rail">
        {/* D2: left, the title block stacked on the calibration label; right, the first frame (M1),
            its top on the title block's */}
        <div className="work__top">
          <div className="work__left">
            <header className="work__head">
              <SlugLine id={serial} archive={!work.inLineup} />
              <h1>{work.title}</h1>
              <p className="work__meta">
                {work.role} · {work.year}
              </p>
            </header>
            <SpecPlate work={work} serial={serial} />
          </div>
          <div className="work__m1">
            <ProofStrip deliverables={work.deliverables} serialBase={serial} items={[0]} layout="one" label="Opening deliverable" />
            <UvCaption notes={work.uvNotes.map((n) => n.text)} />
          </div>
        </div>

        {/* D3: the story. P1 centred; M2 and M3 side by side; P2 and P3 side by side; then the rest */}
        {work.description?.length ? (
          <div className="work__p1 work__copy" data-reveal="">
            {work.description.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}
          </div>
        ) : null}
        <ProofStrip deliverables={work.deliverables} serialBase={serial} items={[1, 2]} layout="pair" label="Deliverables 2 and 3" />
        {sections.length > 0 && (
          <div className="work__pp work__copy" data-count={Math.min(2, sections.length)} data-reveal="">
            {sections.map((sec) => (
              <section key={sec.heading} className="work__section">
                <h2>{sec.heading}</h2>
                {sec.body.map((p) => <p key={p.slice(0, 32)}>{p}</p>)}
              </section>
            ))}
          </div>
        )}
        {more.length > 0 && <ProofStrip deliverables={work.deliverables} serialBase={serial} items={more} layout="grid" label="More deliverables" />}
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

      {/* P7 (09): the ending. The live link again (G), then the previous and next projects as two large
          cover cards (wrapping round the lineup); the closing "Book a viewing" block (M3) is the footer */}
      <section className="workend rail" aria-label="More work" data-reveal="">
        {work.links?.length ? (
          <div className="workend__live">
            <LiveLink work={work} where="end" />
          </div>
        ) : null}
        <nav className="workend__nav" aria-label="Projects">
          {[
            { w: prev, dir: '← Previous project', cls: 'workend__card--prev' },
            { w: next, dir: 'Next on the tray →', cls: 'workend__card--next' },
          ].map(({ w, dir, cls }) => (
            <NextLink key={cls} href={`/work/${w.slug}`} className={`workend__card ${cls}`}>
              <Cover slug={w.slug} className="workend__cover" sizes="(max-width: 760px) 92vw, min(46vw, 900px)" />
              <span className="workend__text">
                <span className="mono workend__dir">{dir}</span>
                <span className="workend__title">{w.title}</span>
                <span className="workend__tags">{w.disciplines.join(' · ')}</span>
              </span>
            </NextLink>
          ))}
        </nav>
      </section>
    </article>
  );
}
