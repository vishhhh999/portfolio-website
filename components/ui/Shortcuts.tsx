'use client';

import { useEffect, useRef, useState } from 'react';

const KEYS: [string, string][] = [
  ['1 – 7', 'Lamps: D50, TL84, A, UV, Flood, Screen, After Dark'],
  ['I', 'House lights (the plain index)'],
  ['S', 'Sound on / off'],
  ['L', 'Spectro loupe (or hold Alt): measure a colour'],
  ['← →', 'Between the samples in the booth'],
  ['Enter', 'Open the focused sample'],
  ['Esc', 'Close'],
  ['?', 'This list'],
];

/** "?" opens the keyboard shortcuts (I5). */
export function Shortcuts() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="shortcuts" aria-label="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <h2 className="mono">Keyboard</h2>
      <dl>
        {KEYS.map(([k, v]) => (
          <div key={k}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <form method="dialog">
        <button className="shortcuts__close mono" type="submit">
          Close
        </button>
      </form>
    </dialog>
  );
}
