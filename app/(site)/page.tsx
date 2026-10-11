import Link from 'next/link';
import { lineup } from '@/content/work';
import { BoothFrame } from '@/components/booth/Booth';
import { HouseIndex } from '@/components/ui/HouseIndex';
import { Cover } from '@/components/ui/Cover';

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title">
            Tested under <em>every</em> light.
          </h1>
          <div className="hero__aside">
            <p className="hero__lead">Brand and digital design by Vishesh Mahendru. India, working worldwide.</p>
            <p className="hero__hint">
              <span className="data">1 to 7</span> change the lamp. Open any piece.
            </p>
          </div>
        </div>
        <BoothFrame />
      </section>
      {/* house lights mode: the flat index in place of the booth, same URL */}
      <section className="houselights houselights--inline" aria-label="Index">
        <HouseIndex heading="h2" />
      </section>
      <section id="work" className="worklist" aria-labelledby="work-title">
        <header className="worklist__head">
          <h2 id="work-title">Work</h2>
          <p className="data">{lineup.length} projects</p>
        </header>
        <ol className="worklist__list">
          {lineup.map((w, i) => (
            <li key={w.slug}>
              <Link href={`/work/${w.slug}`} className="workrow">
                <span className="workrow__no data">{String(i + 1).padStart(2, '0')}</span>
                <span className="workrow__title">{w.title}</span>
                <span className="workrow__tags">{w.disciplines.join(', ')}</span>
                <span className="workrow__year data">{w.year}</span>
                <Cover slug={w.slug} className="workrow__cover" sizes="240px" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
