'use client';

import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';

/** An external link: new tab, rel="noopener", and an "Outbound link" event naming where it went. */
export function OutboundLink({ href, name, className, children }: { href: string; name: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className} onClick={() => track('Outbound link', { name, href })}>
      {children}
    </a>
  );
}
