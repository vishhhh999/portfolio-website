'use client';

import { useEffect, useRef, useState } from 'react';

const KEYS: [string, string][] = [
  ['1 to 7', 'Lamps: D50, TL84, A, UV, Flood, Screen, After Dark'],
  ['I', 'House lights: the flat version of the page'],
  ['S', 'Sound on or off'],
  ['Tab', 'Move between the objects in the booth'],
  ['Enter', 'Open the focused object'],
  ['← →', 'Turn the object on the tray'],
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
    // P8 (09): the dialog is named by its own heading ("Keyboard shortcuts"), never a bare "Keyboard"
    <dialog ref={dialog} className="shortcuts" aria-labelledby="shortcuts-title" onClose={() => setOpen(false)}>
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
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
        <button className="shortcuts__close" type="submit">
          Close
        </button>
      </form>
    </dialog>
  );
}
