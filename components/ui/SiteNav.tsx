'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { contactMailto, CV_HREF } from '@/lib/site';

/**
 * The masthead nav. Desktop: Work, About, CV, Archive in sentence case, and Book a viewing as the one
 * filled button. Phones: the name, Book a viewing, and a Menu button that opens a full-screen sheet.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu', open);
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const links = (
    <>
      <Link href="/#work" aria-current={pathname === '/' ? 'page' : undefined}>Work</Link>
      <Link href="/about" aria-current={pathname === '/about' ? 'page' : undefined}>About</Link>
      <a href={CV_HREF} download onClick={() => track('CV downloaded', { from: 'masthead' })}>CV</a>
      <Link href="/archive" aria-current={pathname === '/archive' ? 'page' : undefined}>Archive</Link>
    </>
  );
  return (
    <>
      <nav aria-label="Site" className="sitenav">
        <div className="sitenav__links">{links}</div>
        <a className="button" href={contactMailto()} onClick={() => track('Book a viewing', { from: 'masthead' })}>
          Book a viewing
        </a>
        <button type="button" className="sitenav__menu" aria-expanded={open} aria-controls="menu-sheet" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </nav>
      <div id="menu-sheet" ref={sheet} className="sheet" data-open={open} hidden={!open}>
        <nav aria-label="Menu" className="sheet__links">
          <Link href="/">Index</Link>
          {links}
          <a href={contactMailto()} onClick={() => track('Book a viewing', { from: 'menu' })}>Book a viewing</a>
        </nav>
      </div>
    </>
  );
}
