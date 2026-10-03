'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useBooth } from '@/lib/store';

const BoothCanvas = dynamic(() => import('./BoothCanvas'), { ssr: false });

/** Routes where the booth is on stage. Everywhere else it is hidden and paused, not unmounted. */
export function boothMode(pathname: string): 'full' | 'header' | 'off' {
  if (pathname === '/') return 'full';
  if (pathname.startsWith('/work/')) return 'header';
  return 'off';
}

/**
 * Mounts the WebGL booth once, after first paint, the first time a booth route
 * is visited. DOM (headline, switches) always renders first for LCP.
 */
export function BoothHost() {
  const pathname = usePathname();
  const mode = boothMode(pathname);
  const setActiveSlug = useBooth((s) => s.setActiveSlug);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);

  // Stop rendering once the booth has scrolled out of view (project pages).
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setActiveSlug(pathname.startsWith('/work/') ? pathname.split('/')[2] ?? null : null);
  }, [pathname, setActiveSlug]);

  useEffect(() => {
    if (mounted || mode === 'off') return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const id = idle(() => setMounted(true));
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, [mode, mounted]);

  return (
    <div ref={hostRef} className="booth" data-mode={mode} aria-hidden="true">
      {mounted && <BoothCanvas active={mode !== 'off' && inView} />}
    </div>
  );
}
