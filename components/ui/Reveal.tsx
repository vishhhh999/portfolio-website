'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * P9 (09): case-study sections reveal once, by opacity only (250ms; siblings revealed together
 * stagger by at most 120ms). Proof crop marks and the palette bar draw in on the line itself
 * (globals.css), never on an image. Whatever is already on screen when the page arrives is shown at
 * once, so nothing that was visible ever blinks out. Off under reduced motion and in house lights.
 */
export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => !el.hasAttribute('data-revealed'));
    const below = els.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
    for (const el of els) if (!below.includes(el)) el.setAttribute('data-revealed', '');
    if (!below.length) return;
    root.setAttribute('data-reveal-on', '');
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        shown.forEach((el, i) => {
          el.style.transitionDelay = `${Math.min(120, i * 60)}ms`;
          el.setAttribute('data-revealed', '');
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    below.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
