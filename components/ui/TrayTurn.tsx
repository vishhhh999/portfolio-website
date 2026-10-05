'use client';

import { KEY_STEP, nudgeSpin } from '@/lib/spin';

/**
 * I2: the project-page header as a keyboard target: focus it and ← → turn the sample on the tray
 * 15° a press (dragging it with the pointer does the same). Nothing else moves.
 */
export function TrayTurn({ slug, title }: { slug: string; title: string }) {
  return (
    <button
      type="button"
      className="work__turn"
      aria-label={`${title} on the tray. Left and right arrow keys turn it`}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        nudgeSpin(slug, e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP);
      }}
    >
      <span className="mono">← → turn the sample</span>
    </button>
  );
}
