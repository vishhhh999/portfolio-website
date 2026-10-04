'use client';

import { useEffect, useRef } from 'react';
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

const STAMP_KEY = 'vm:stamped:v1';

/** The certificate's PASS stamp: stamps once per visit when it scrolls into view. */
export function PassStamp() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        let seen = false;
        try {
          seen = sessionStorage.getItem(STAMP_KEY) === '1';
          sessionStorage.setItem(STAMP_KEY, '1');
        } catch {}
        if (seen) return;
        el.dataset.stamp = 'on';
        const r = el.getBoundingClientRect();
        playEvent('stamp', r.left + r.width / 2);
      },
      { threshold: 0.9 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="calib__stamp cert__stamp" aria-hidden="true">
      PASS
    </span>
  );
}
