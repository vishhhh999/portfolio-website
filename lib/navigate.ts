'use client';

import type { useRouter } from 'next/navigation';

type Router = ReturnType<typeof useRouter>;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Booth → project (I1). The camera dollies into the sample over ~700ms (the booth reacts to the new
 * route on its own); the page itself crossfades through the View Transitions API where it exists.
 * The canvas is its own transition group shown live (globals.css), so the dolly is never a frozen
 * snapshot. Elsewhere, and under reduced motion, the route's plain crossfade (Providers) is used.
 */
export function openProject(router: Router, href: string) {
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown };
  if (!doc.startViewTransition || reduced()) {
    router.push(href, { scroll: false });
    return;
  }
  doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const target = new URL(href, location.href).pathname;
        router.push(href, { scroll: false });
        const t0 = performance.now();
        const wait = () => (location.pathname === target || performance.now() - t0 > 1500 ? requestAnimationFrame(() => resolve()) : requestAnimationFrame(wait));
        wait();
      }),
  );
}
