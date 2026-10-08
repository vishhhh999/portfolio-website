'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBooth } from '@/lib/store';
import { track } from '@/lib/analytics';
import { contactMailto, CV_HREF } from '@/lib/site';

/**
 * C5: the site nav. On "/" the first item swaps the home view in place (the URL never changes):
 * "Index" shows the project list, "3D viewport" brings the booth back. On every other page it is
 * "Home" → "/". House lights is a separate mode (the rocker and I), never this item.
 * P4 (09): the CV beside About, and a filled "Book a viewing" button at the right end (it opens the
 * visitor's own mail app with a message ready, M5), so a recruiter never has to scroll for either.
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
      <Link href="/about" aria-current={pathname === '/about' ? 'page' : undefined}>
        About
      </Link>
      <a href={CV_HREF} download onClick={() => track('CV downloaded', { from: 'masthead' })}>
        CV
      </a>
      <Link href="/archive" aria-current={pathname === '/archive' ? 'page' : undefined}>
        Archive
      </Link>
      <a className="sitenav__book" href={contactMailto()} onClick={() => track('Book a viewing', { from: 'masthead' })}>
        Book a viewing
      </a>
    </nav>
  );
}
