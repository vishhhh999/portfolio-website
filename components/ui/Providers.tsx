'use client';

import { ReactLenis, type LenisRef } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { readLampPreference, useBooth } from '@/lib/store';
import { playEvent, restoreSoundPreference } from '@/lib/sound';
import { houseLightsOnLoad } from '@/lib/houseLights';
import { measure } from '@/components/booth/frames';

/** Lenis smooth scroll (its own rAF) and the per-route housekeeping: lamp and house lights on load, top of page on a route change. */
export function Providers({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const lamp = readLampPreference();
    if (lamp !== 'D50') useBooth.setState({ lamp, lampPicked: true, strikeProgress: 1 });
    if (houseLightsOnLoad()) useBooth.setState({ houseLights: true });
    restoreSoundPreference();
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const lenis = lenisRef.current?.lenis;
    const hash = window.location.hash;
    if (lenis) {
      lenis.resize();
      if (hash) lenis.scrollTo(hash, { immediate: true, force: true });
      else lenis.scrollTo(0, { immediate: true, force: true });
    } else if (!hash) window.scrollTo(0, 0);
    playEvent('route');
    const main = document.getElementById('main');
    if (main) {
      main.removeAttribute('data-arrive');
      void main.offsetWidth;
      main.setAttribute('data-arrive', '');
    }
    requestAnimationFrame(() => {
      lenisRef.current?.lenis?.resize();
      measure();
    });
  }, [pathname]);

  return (
    <ReactLenis root ref={lenisRef} options={{ autoRaf: true, lerp: 0.14 }}>
      {children}
    </ReactLenis>
  );
}
