'use client';

import { useState } from 'react';
import { CONTACT_EMAIL } from '@/lib/site';
import { track } from '@/lib/analytics';
import { playEvent } from '@/lib/sound';

/** The email address as a button that copies it (the mailto link sits beside it). */
export function CopyEmail({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`copyemail ${className ?? ''}`}
      onClick={async (e) => {
        try {
          await navigator.clipboard.writeText(CONTACT_EMAIL);
        } catch {
          return;
        }
        playEvent('stamp', e.clientX);
        track('Email copied');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      aria-live="polite"
    >
      <span className="mono">{CONTACT_EMAIL}</span>
      <span className="copyemail__state">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
