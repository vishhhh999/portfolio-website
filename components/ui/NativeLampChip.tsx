'use client';

import { pickLamp } from '@/lib/lampController';
import { lampById } from '@/lib/lampPresets';
import { playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { useBooth } from '@/lib/store';
import type { Lamp } from '@/lib/types';

const SHORT: Record<Lamp, string> = { D50: 'D50', TL84: 'TL84', A: 'A', UV: 'UV', FLOOD: 'Flood', SCREEN: 'Screen', AFTERDARK: 'After Dark' };

/**
 * The project's native lamp as a suggestion, never an action: the page loads under whatever the
 * visitor picked (D50 until they pick). Clicking the chip is a manual pick like any switch.
 */
export function NativeLampChip({ lamp }: { lamp: Lamp }) {
  const active = useBooth((s) => s.lamp) === lamp;
  return (
    <button
      type="button"
      className="lampchip"
      aria-pressed={active}
      disabled={active}
      style={{ ['--lamp' as string]: lampById(lamp).indicator }}
      onClick={(e) => {
        playEvent(`switch:${lamp}`, e.clientX);
        pickLamp(lamp);
        track('Lamp picked', { lamp, from: 'native chip' });
      }}
    >
      <span className="lampchip__led" aria-hidden="true" />
      Native lamp: {SHORT[lamp]}
      <span aria-hidden="true"> · </span>
      {active ? 'Viewing under it' : 'View under it'}
    </button>
  );
}
