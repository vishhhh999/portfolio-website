'use client';

import { useEffect, useState } from 'react';
import { NOTICE } from '@/lib/resilience';

/** The one quiet line when the booth stepped aside on its own (I4). Fixed: it never moves the page. */
export function Notice() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const n = new URLSearchParams(location.search).get('notice') as keyof typeof NOTICE | null;
    if (n && NOTICE[n]) setText(NOTICE[n]);
  }, []);
  if (!text) return null;
  return (
    <p className="notice mono" role="status">
      {text}
      <button type="button" className="notice__close" aria-label="Dismiss" onClick={() => setText(null)}>
        ×
      </button>
    </p>
  );
}
