import { lampById } from '@/lib/lampPresets';
import type { Work } from '@/lib/types';
import { NativeLampChip } from './NativeLampChip';
import { LiveLink } from './LiveLink';

/** The spec plate, styled as a booth calibration label. */
export function SpecPlate({ work, serial }: { work: Work; serial: number }) {
  const rows: [string, string][] = [
    ['Client type', work.clientType ?? 'TBC'],
    ['Role', work.role],
    ['Year', String(work.year)],
    ['Scope', work.scope],
    ['Disciplines', work.disciplines.join(' · ')],
    ['Native lamp', work.inLineup ? lampById(work.nativeLamp).label : 'Archive'],
  ];
  return (
    <section className="calib" aria-label="Project specification">
      <header className="calib__head">
        <span>Calibration label</span>
        <span>VM booth 01 · SN {String(serial).padStart(4, '0')}</span>
      </header>
      <dl className="calib__rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {/* G (09): the live link as a button, inside the label (Mitooshi, Sonde, House of Hex and Indo Thai only) */}
      {work.links?.length ? (
        <div className="calib__live">
          <LiveLink work={work} where="label" />
        </div>
      ) : null}
      {work.inLineup && work.nativeLamp !== 'D50' && <NativeLampChip lamp={work.nativeLamp} />}
    </section>
  );
}
