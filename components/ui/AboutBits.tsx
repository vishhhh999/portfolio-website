'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { playEvent } from '@/lib/sound';

/** "Download CV": a paper-feed sound and an analytics event, then the PDF. */
export function CvLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      onClick={(e) => {
        playEvent('paperFeed', e.clientX);
        track('CV downloaded');
      }}
    >
      Download CV ↓
    </a>
  );
}

const fmt = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

/**
 * E1: the time in India, 24h HH:MM, ticking on the minute. Client-only: the server renders a blank
 * of the same width, so hydration never mismatches. Not announced (aria-live off).
 */
export function IstClock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setTime(fmt());
      id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    return () => window.clearTimeout(id);
  }, []);
  return (
    <span className="istclock mono" aria-live="off">
      <time suppressHydrationWarning>{time ?? '--:--'}</time> IST
    </span>
  );
}
