'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';

/** A house-lights index row: records which project was opened from the index. */
export function IndexLink({ href, slug, label, children }: { href: string; slug: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} onClick={() => track('Project opened', { slug, from: 'index' })}>
      {children}
    </Link>
  );
}
