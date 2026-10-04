import { lineup, works } from '@/content/work';
import { IndexLink } from './IndexLink';

/** The flat project index: /house-lights, and "/" in house lights mode. Plain, fast, no WebGL. */
export function HouseIndex({ heading = 'h1' }: { heading?: 'h1' | 'h2' }) {
  const H = heading;
  return (
    <>
      <header className="houselights__head">
        <H className="houselights__title">House lights on.</H>
        <p className="mono">
          {works.length} projects · {lineup.length} in the booth · press I to switch it back on
        </p>
      </header>
      <ol className="index">
        <li className="index__legend mono" aria-hidden="true">
          <span>No.</span>
          <span>Project</span>
          <span>Object in booth</span>
          <span>Disciplines</span>
          <span>Year</span>
        </li>
        {works.map((w, i) => (
          <li key={w.slug}>
            <IndexLink href={`/work/${w.slug}`} slug={w.slug} label={`${w.title}${w.inLineup ? '' : ', archive'}`}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="index__title">
                {w.title}
                {!w.inLineup && <span className="index__archive mono">Archive</span>}
              </span>
              <span className="index__object">{w.inLineup ? w.object : 'Archive · not in the booth'}</span>
              <span className="index__tags">{w.disciplines.join(' · ')}</span>
              <span className="mono">{w.year}</span>
            </IndexLink>
          </li>
        ))}
      </ol>
    </>
  );
}
