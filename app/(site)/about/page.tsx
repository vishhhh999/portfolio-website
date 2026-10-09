import type { Metadata } from 'next';
import { about } from '@/content/about';
import { CvLink, IstClock } from '@/components/ui/AboutBits';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { SOCIALS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'Vishesh Mahendru: visual designer in India, working across brand identity, digital design and 3D visualization.',
  alternates: { canonical: '/about' },
};

/**
 * The about page as a colour lab's certificate of calibration. Full width, gutter to gutter: two
 * columns from 1100px (the person on the left, the record on the right), one column below. The
 * email and its copy button live in the site footer only.
 */
export default function AboutPage() {
  const { award, education } = about;
  return (
    <section className="page about">
      <article className="cert" aria-labelledby="cert-name">
        <header className="cert__head">
          <span>Certificate of calibration</span>
          <span>VM booth 01 · Cert. no. 0001</span>
        </header>

        <div className="cert__body">
          <div className="cert__col cert__col--person">
            <p className="mono cert__issued">This is to certify that</p>
            <h1 id="cert-name">{about.name}</h1>
            <p className="cert__discipline">
              {about.discipline} · {about.location}
            </p>

            <dl className="cert__fields">
              <div>
                <dt>Certified illuminants</dt>
                <dd>{about.disciplines.join(' · ')}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd className="cert__where">
                  {about.location} <IstClock />
                </dd>
              </div>
            </dl>

            <section className="cert__section" aria-labelledby="cert-what">
              <h2 id="cert-what">What I do</h2>
              {about.summary.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </section>

            <figure className="cert__portrait">
              <picture>
                <source srcSet={about.portrait.avif} type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={about.portrait.src} alt={about.portrait.alt} width={about.portrait.width} height={about.portrait.height} fetchPriority="high" decoding="async" />
              </picture>
              <figcaption className="mono">Specimen · black and white</figcaption>
            </figure>
          </div>

          <div className="cert__col cert__col--record">
            <section className="cert__section" aria-labelledby="cert-exp">
              <h2 id="cert-exp">Experience</h2>
              <ol className="cert__log">
                {about.experience.map((e) => (
                  <li key={`${e.role}-${e.where}-${e.years}`}>
                    <span className="mono">{e.years}</span>
                    <span>
                      {e.role} · {e.where}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <dl className="cert__fields cert__section">
              <div>
                <dt>Education</dt>
                <dd>
                  {education.degree} · {education.school} · {education.years}
                </dd>
              </div>
              <div>
                <dt>Awards</dt>
                <dd>
                  {award.level} · {award.name} · {award.year} · {award.category}
                </dd>
              </div>
              <div>
                <dt>Tool stack</dt>
                <dd>{about.tools.join(' · ')}</dd>
              </div>
            </dl>

            <section className="cert__section" aria-labelledby="cert-clients">
              <h2 id="cert-clients">Clients</h2>
              <ul className="cert__clients" role="list">
                {about.clients.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>

            <p className="cert__links">
              <CvLink href={about.cv} />
              {SOCIALS.map((s) => (
                <OutboundLink key={s.label} href={s.href} name={s.label}>
                  {s.label} ↗
                </OutboundLink>
              ))}
            </p>
          </div>
        </div>

      </article>
    </section>
  );
}
