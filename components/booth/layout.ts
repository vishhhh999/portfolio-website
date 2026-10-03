import { works } from '@/content/work';
import { PLACEHOLDERS } from './placeholders';

/** Booth interior in metres. Origin: floor, centre of the lineup row. */
export const BOOTH = { width: 4.2, depth: 5, height: 2.4, backZ: -0.7 } as const;
export const LINEUP_GAP = 0.12;
/** Where an object sits when it is pulled forward onto the tray. */
export const TRAY_Z = 0.45;
/** Lens: ~100mm full-frame equivalent → 2·atan(12/100) ≈ 13.7° vertical FOV. */
export const FOV = 13.7;

const widths = works.map((w) => PLACEHOLDERS[w.slug]?.width ?? 0.2);
export const LINEUP_WIDTH = widths.reduce((a, b) => a + b, 0) + LINEUP_GAP * (works.length - 1);

/** x position of each object's base centre, in lineup order. */
export const LINEUP_X: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let x = -LINEUP_WIDTH / 2;
  works.forEach((w, i) => {
    out[w.slug] = x + widths[i] / 2;
    x += widths[i] + LINEUP_GAP;
  });
  return out;
})();
