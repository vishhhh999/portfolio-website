'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { setHouseLightsMode } from '@/lib/houseLights';

/** "Index": the home page with house lights on (the flat index at "/"), never a separate page. */
export function IndexNavLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Link href="/" className={className} onClick={() => setHouseLightsMode(true)}>
      {children}
    </Link>
  );
}
