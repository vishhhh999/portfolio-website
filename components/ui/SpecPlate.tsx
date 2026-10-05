import { lampById } from '@/lib/lampPresets';
import type { Work } from '@/lib/types';
import { NativeLampChip } from './NativeLampChip';
import { OutboundLink } from './OutboundLink';

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
      {/* D4: the live link, inside the label (Mitooshi, Sonde, House of Hex and Indo Thai only) */}
      {work.links?.map((l) => (
        <OutboundLink key={l.href} href={l.href} name={`${work.slug}: ${l.label}`} className="calib__link">
          <span>{l.label} ↗</span>
          <span className="calib__linkhost" aria-hidden="true">{new URL(l.href).hostname.replace(/^www\./, '')}</span>
        </OutboundLink>
      ))}
      {work.inLineup && work.nativeLamp !== 'D50' && <NativeLampChip lamp={work.nativeLamp} />}
      <footer className="calib__foot">
        <span>Checked under D50 · TL84 · A · UV-A</span>
        <span className="calib__stamp" aria-hidden="true">PASS</span>
      </footer>
    </section>
  );
}
