import Link from 'next/link';
import { lineup } from '@/content/work';
import { BoothFrame } from '@/components/booth/BoothFrame';
import { STAGING } from '@/components/booth/staging';
import { HouseIndex } from '@/components/ui/HouseIndex';
import { HomeIndex } from '@/components/ui/HomeIndex';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <h1>
            Tested under
            <br />
            every light.
          </h1>
          <p>Brand and digital design by Vishesh Mahendru. India, working worldwide.</p>
        </div>
        {/* the viewing booth sits here, as an object on the page */}
        <BoothFrame
          samples={[...lineup]
            .sort((a, b) => STAGING[a.slug].x - STAGING[b.slug].x)
            .map((w) => ({ slug: w.slug, title: w.title, meta: w.disciplines.join(' · ') }))}
        />
        {/* C4: the lamp panel sits here on home, centred under the booth, in the flow */}
        <div id="panel-slot" className="panel-slot" />
        <HomeIndex />
      </section>
      {/* house lights mode: the flat index in place of the booth, same URL (shown by <html data-house-lights>) */}
      <section className="houselights houselights--inline" aria-label="Index">
        <HouseIndex heading="h2" />
      </section>
      {/* Crawlable, keyboard-reachable lineup. The canvas is presentational only. */}
      <nav aria-label="Work" className="sr-only">
        <ul>
          {lineup.map((w) => (
            <li key={w.slug}>
              <Link href={`/work/${w.slug}`}>{w.title}, {w.disciplines.join(', ')}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
