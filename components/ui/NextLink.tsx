'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { navIntent } from './Providers';

/** Next project: the page scrolls up while the next sample slides onto the tray. No page flash. */
export function NextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} scroll={false} className="next" onClick={() => (navIntent.smoothTop = true)}>
      {children}
    </Link>
  );
}
