'use client';

import { ReactLenis, type LenisRef } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { readLampPreference, useBooth } from '@/lib/store';
import { playEvent, restoreSoundPreference } from '@/lib/sound';
import { attachLenis, startClock } from '@/lib/clock';
import { measure } from '@/lib/views';
import { houseLightsOnLoad } from '@/lib/houseLights';

/** Set just before a "next project" navigation: scroll up smoothly while the next sample slides onto the tray. */
export const navIntent = { smoothTop: false };

/**
 * Lenis smooth scroll on the page's single clock (lib/clock.ts): the shared
 * clock runs Lenis, then the canvas, in that order, every tick.
 */
export function Providers({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const pathname = usePathname();

  // The visitor's lamp pick for this session, applied before the first paint after hydration
  // (server HTML is always D50, so hydration matches). A route never changes it.
  useLayoutEffect(() => {
    const lamp = readLampPreference();
    if (lamp !== 'D50') useBooth.setState({ lamp, lampPicked: true, strikeProgress: 1 });
    // house lights mode as the pre-paint script set it from the stored preference
    if (houseLightsOnLoad()) useBooth.setState({ houseLights: true });
    restoreSoundPreference();
  }, []);

  useEffect(() => {
    attachLenis(() => lenisRef.current?.lenis);
    startClock();
    return () => attachLenis(() => null);
  }, []);

  // Route change: Lenis keeps its old scroll target and page height unless told otherwise, which can
  // pin a new page at the old offset (or stop it scrolling at all). Re-measure and go to the top.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const lenis = lenisRef.current?.lenis;
    if (lenis) {
      lenis.resize();
      if (navIntent.smoothTop) lenis.scrollTo(0, { duration: 1.1 });
      else lenis.scrollTo(0, { immediate: true, force: true });
    } else window.scrollTo(0, 0);
    navIntent.smoothTop = false;
    playEvent('route');
    // the plain crossfade for the page (also Back, and wherever View Transitions are missing)
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
    <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.12 }}>
      {children}
    </ReactLenis>
  );
}
