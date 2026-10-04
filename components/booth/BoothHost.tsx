'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { autoHouseLights, failsPerformanceCaveat, setNavigator } from '@/lib/resilience';
import { isInLineup } from '@/content/work';
import { lampById } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { onViewsChanged, registerStage, viewCount } from '@/lib/views';

const BoothCanvas = dynamic(() => import('./BoothCanvas'), { ssr: false });

/** Routes where the booth is on stage. Everywhere else there is no stage (planes may still draw). */
export function boothMode(pathname: string): 'full' | 'header' | 'off' {
  if (pathname === '/') return 'full';
  if (pathname.startsWith('/work/') && isInLineup(pathname.split('/')[2] ?? '')) return 'header';
  return 'off';
}

/**
 * Owns the booth stage (a DOM rect the canvas draws the booth into) and the
 * one fixed, full-screen, transparent canvas behind the page.
 *
 * First paint: the stage is booth grey with a pre-rendered D50 poster of this
 * exact shot (the LCP image) and the headline over it in dark ink. The 3D code
 * loads after first paint; once the live booth has drawn, the poster fades out
 * and the canvas is revealed underneath. The dark-lamp text theme only applies
 * once a dark lamp is actually being drawn.
 */
export function BoothHost({ lightmap = null }: { lightmap?: string | null }) {
  const pathname = usePathname();
  const mode = boothMode(pathname);
  const setActiveSlug = useBooth((s) => s.setActiveSlug);
  const lamp = useBooth((s) => s.lamp);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasViews, setHasViews] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => setNavigator((href) => router.replace(href)), [router]);

  // Project pages: the sample goes on the tray. The lamp is never changed by a route: it stays
  // whatever the visitor picked (D50 until they pick); the native lamp is offered as a chip.
  useEffect(() => {
    setActiveSlug(mode === 'header' ? pathname.split('/')[2] : null);
  }, [pathname, mode, setActiveSlug]);

  useEffect(() => {
    if (mode === 'off' || !stageRef.current) return;
    return registerStage(stageRef.current);
  }, [mode]);

  useEffect(() => {
    const update = () => setHasViews(viewCount() > 0);
    update();
    return onViewsChanged(update);
  }, []);

  // DOM over the booth flips to light text only when a dark lamp is really on screen.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.lamp = lamp;
    // home: the headline sits on paper, never over the booth; only the project-page tray view sits under text
    root.dataset.dark = String(ready && mode === 'header' && lampById(lamp).dark);
  }, [lamp, mode, ready]);

  // Load the 3D after first paint, as soon as there is anything for it to draw. A GPU that fails
  // the browser's major-performance-caveat test (software rendering) gets house lights instead.
  useEffect(() => {
    if (mounted || !hasViews) return;
    if (mode !== 'off' && failsPerformanceCaveat()) {
      autoHouseLights('speed');
      return;
    }
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    const id = idle(() => setMounted(true), { timeout: 1200 });
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, [hasViews, mounted, mode]);

  return (
    <>
      <div className="booth-canvas" data-visible={hasViews} aria-hidden="true">
        {mounted && <BoothCanvas onReady={() => setReady(true)} lightmap={lightmap} />}
      </div>
      {mode !== 'off' && (
        <div ref={stageRef} className="booth-stage" data-mode={mode} data-ready={ready} aria-hidden="true">
          {mode === 'full' && (
            <picture className="booth-poster">
              <source media="(max-aspect-ratio: 1/1)" srcSet="/booth/poster-portrait.webp" type="image/webp" />
              <source media="(min-aspect-ratio: 17/10)" srcSet="/booth/poster-16x9.webp" type="image/webp" />
              <source srcSet="/booth/poster-16x10.webp" type="image/webp" />
              <img src="/booth/poster-16x10.jpg" alt="" width={1440} height={900} fetchPriority="high" decoding="async" />
            </picture>
          )}
        </div>
      )}
    </>
  );
}
