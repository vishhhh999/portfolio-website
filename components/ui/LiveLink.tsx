import type { Work } from '@/lib/types';
import { OutboundLink } from './OutboundLink';

/**
 * G (09): the outbound link (Mitooshi, House of Hex and Indo Thai: their live sites; Sonde: its
 * Behance case study) as a real filled button: dark fill, light text, the arrow nudging on hover, a
 * visible focus ring. New tab, rel="noopener". Shown inside the calibration label and again at the
 * end of the case study.
 */
export function LiveLink({ work, where }: { work: Work; where: 'label' | 'end' }) {
  const l = work.links?.[0];
  if (!l) return null;
  return (
    <OutboundLink href={l.href} name={`${work.slug}: ${l.label} (${where})`} className={`livelink livelink--${where}`}>
      <span>{l.label}</span>
      <span className="livelink__arrow" aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </OutboundLink>
  );
}
