import type { Metadata } from 'next';
import { about, type Copy } from '@/content/about';
import { CONTACT_EMAIL, CONTACT_MAILTO, SITE_HOST, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'Vishesh Mahendru: visual designer in India, working across brand identity, digital design and 3D visualization.',
  alternates: { canonical: '/about' },
};

/** Renders copy; a placeholder shows up visibly marked so it can't ship unnoticed. */
function C({ v }: { v: Copy }) {
  return typeof v === 'string' ? <>{v}</> : <mark className="tbc">[TBC: {v.tbc}]</mark>;
}

/** The about page as a colour lab's certificate of calibration. */
export default function AboutPage() {
  return (
    <section className="page about">
      <article className="cert" aria-labelledby="cert-name">
        <header className="cert__head">
          <span>Certificate of calibration</span>
          <span>VM booth 01 · Cert. no. 0001</span>
        </header>

        <div className="cert__body">
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
              <dd>
                {about.location} · {about.remote}
              </dd>
            </div>
          </dl>

          <section className="cert__section" aria-labelledby="cert-what">
            <h2 id="cert-what">What I do</h2>
            {about.summary.map((p, i) => (
              <p key={i}>
                <C v={p} />
              </p>
            ))}
            <p className="cert__statement">
              <C v={about.statement} />
            </p>
          </section>

          <section className="cert__section" aria-labelledby="cert-exp">
            <h2 id="cert-exp">Readings on record</h2>
            <ol className="cert__log">
              {about.experience.map((e) => (
                <li key={`${e.role}-${e.years}`}>
                  <span className="mono">{e.years}</span>
                  <span>
                    {e.role}
                    {e.where ? ` · ${e.where}` : ''}
                  </span>
                </li>
              ))}
            </ol>
            <p className="cert__note">
              <C v={about.experienceNote} />
            </p>
            <dl className="cert__fields">
              <div>
                <dt>Education</dt>
                <dd>
                  {about.education.degree} · <C v={about.education.school} /> · {about.education.years}
                </dd>
              </div>
              <div>
                <dt>Award</dt>
                <dd>
                  {about.award.title} · <C v={about.award.body} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="cert__section cert__contact" aria-labelledby="cert-contact">
            <h2 id="cert-contact">Book a viewing</h2>
            <p>
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
              <br />
              <a href={SITE_URL}>{SITE_HOST}</a>
            </p>
          </section>
        </div>

        <footer className="cert__foot">
          <span className="cert__sign">
            <span className="cert__line" aria-hidden="true" />
            <span className="mono">Checked under D50 · TL84 · A · UV-A</span>
          </span>
          <span className="calib__stamp" aria-hidden="true">PASS</span>
        </footer>
      </article>
    </section>
  );
}
