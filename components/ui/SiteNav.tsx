'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBooth } from '@/lib/store';
import { track } from '@/lib/analytics';

/**
 * C5: the site nav. On "/" the first item swaps the home view in place (the URL never changes):
 * "Index" shows the project list, "3D viewport" brings the booth back. On every other page it is
 * "Home" → "/". House lights is a separate mode (the rocker and I), never this item.
 */
export function SiteNav() {
  const pathname = usePathname();
  const homeIndex = useBooth((s) => s.homeIndex);
  const setHomeIndex = useBooth((s) => s.setHomeIndex);
  return (
    <nav aria-label="Site" className="sitenav">
      {pathname === '/' ? (
        <button
          type="button"
          className="sitenav__switch"
          aria-pressed={homeIndex}
          onClick={() => {
            setHomeIndex(!homeIndex);
            track('Home view', { view: homeIndex ? '3d' : 'index' });
            window.scrollTo({ top: 0 });
          }}
        >
          {homeIndex ? '3D viewport' : 'Index'}
        </button>
      ) : (
        <Link href="/">Home</Link>
      )}
      <Link href="/about">About</Link>
      <Link href="/archive">Archive</Link>
    </nav>
  );
}
