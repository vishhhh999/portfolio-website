'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { navIntent } from './Providers';
import { useBooth } from '@/lib/store';
import { isInLineup } from '@/content/work';

/** Previous or next project: the page scrolls up while the next sample slides onto the tray. No page flash. */
export function NextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} scroll={false} className={`next ${className ?? ''}`} onClick={() => {
        navIntent.smoothTop = true;
        // the next sample starts for the tray on the click, not when the route has arrived (A3)
        const slug = href.split('/')[2];
        if (slug && isInLineup(slug)) useBooth.getState().setActiveSlug(slug);
      }}>
      {children}
    </Link>
  );
}
