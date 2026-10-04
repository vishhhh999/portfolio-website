'use client';

import type { useRouter } from 'next/navigation';
import { useBooth } from './store';
import { avifFor } from '@/content/masters';
import { getWork, isInLineup } from '@/content/work';

type Router = ReturnType<typeof useRouter>;

/**
 * Opening a project from the booth (home → project, project → project). The booth reacts on the
 * click itself: the sample is set on the tray in the same task, so the canvas animates from the
 * very next frame (the old sample goes back to its base, the new one slides onto the tray, ~700ms,
 * on the shared clock). The route follows; the page crossfades in underneath (Providers).
 *
 * No View Transitions here: a view transition shows a frozen snapshot until the new route has
 * rendered, which is exactly the multi-second freeze with no animation that A3 reported.
 */
export function openProject(router: Router, href: string) {
  const slug = new URL(href, location.href).pathname.split('/')[2];
  if (slug && isInLineup(slug)) useBooth.getState().setActiveSlug(slug);
  router.push(href, { scroll: false });
}

const warmed = new Set<string>();
/** Hover (or focus) on a sample: fetch its route and its first proof before the click. */
export function warmProject(router: Router, slug: string) {
  if (warmed.has(slug)) return;
  warmed.add(slug);
  router.prefetch(`/work/${slug}`);
  const first = getWork(slug)?.deliverables[0];
  const src = first ? (first.type === 'video' ? first.poster : avifFor(first.src) ?? first.src) : null;
  if (src) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}
