'use client';

import { useBooth } from '@/lib/store';

/**
 * C3: under the UV lamp, the project's approved UV notes show as a mono caption strip directly
 * below the first proof, in fluorescent-ink styling on the page. Never printed on the photo.
 */
export function UvCaption({ notes }: { notes: string[] }) {
  const on = useBooth((s) => s.lamp === 'UV' && !s.houseLights);
  if (!on || !notes.length) return null;
  return (
    <aside className="uvcaption mono" aria-label="Proofer's notes, under UV">
      <span className="uvcaption__label">UV-A · proofer&apos;s notes</span>
      <ol>
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ol>
    </aside>
  );
}
