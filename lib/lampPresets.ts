import type { Lamp } from './types';

export type LampMeta = {
  id: Lamp;
  /** Switch label, e.g. "D50 · DAYLIGHT". */
  label: string;
  /** Accessible name, e.g. "Daylight, D50". */
  ariaLabel: string;
  /** Mono readout next to the switch. */
  readout: string;
  /** Keyboard shortcut. */
  key: string;
  /** Indicator lamp colour: the lamp's own physical colour. */
  indicator: string;
  /** Nominal colour temperature in K, null for non-blackbody sources. */
  kelvin: number | null;
};

/**
 * Switch metadata. Light rigs, colour matrices and strike curves
 * get added per preset in Phase 2.
 */
export const LAMPS: LampMeta[] = [
  { id: 'D50', label: 'D50 · Daylight', ariaLabel: 'Daylight, D50', readout: '5000K', key: '1', indicator: '#F4F3EE', kelvin: 5000 },
  { id: 'TL84', label: 'TL84 · Store', ariaLabel: 'Store light, TL84', readout: 'TL84', key: '2', indicator: '#E6F2DC', kelvin: 4000 },
  { id: 'A', label: 'A · Home', ariaLabel: 'Home light, Illuminant A', readout: '2856K', key: '3', indicator: '#FFB45C', kelvin: 2856 },
  { id: 'UV', label: 'UV · Blacklight', ariaLabel: 'Blacklight, UV', readout: 'UV-A', key: '4', indicator: '#8B5CFF', kelvin: null },
  { id: 'FLOOD', label: 'Flood', ariaLabel: 'Stadium floodlight', readout: '5700K', key: '5', indicator: '#EAF2FF', kelvin: 5700 },
  { id: 'SCREEN', label: 'Screen', ariaLabel: 'Screens only', readout: 'EMIT', key: '6', indicator: '#C8F4FF', kelvin: null },
  { id: 'AFTERDARK', label: 'After Dark', ariaLabel: 'After dark, hand lamp', readout: 'OFF', key: '7', indicator: '#FF2A1A', kelvin: null },
];

export const lampById = (id: Lamp) => LAMPS.find((l) => l.id === id)!;
