'use client';

import { useBooth } from '@/lib/store';

/** The one quiet line when the booth stepped aside on its own (I4). Fixed: it never moves the page. */
export function Notice() {
  const text = useBooth((s) => s.notice);
  if (!text) return null;
  return (
    <p className="notice mono" role="status">
      {text}
      <button type="button" className="notice__close" aria-label="Dismiss" onClick={() => useBooth.setState({ notice: null })}>
        ×
      </button>
    </p>
  );
}
