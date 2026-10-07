'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { autoHouseLights, failsPerformanceCaveat } from '@/lib/resilience';
import { isInLineup } from '@/content/work';
import { lampById } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { resetSpins } from '@/lib/spin';
import { prepareOpening, runOpening } from '@/lib/lampController';
import { playEvent } from '@/lib/sound';
import { logEvent } from '@/lib/eventLog';
import { onViewsChanged, registerStage, viewCount } from '@/lib/views';
import type { BoothLightmap } from './BoothRoom';

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
export function BoothHost({ lightmap = null }: { lightmap?: BoothLightmap | null }) {
  const pathname = usePathname();
  const mode = boothMode(pathname);
  const setActiveSlug = useBooth((s) => s.setActiveSlug);
  const lamp = useBooth((s) => s.lamp);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasViews, setHasViews] = useState(false);
  // P2 (09): the tray poster stays through its 300ms crossfade after the reveal, then leaves the DOM
  // (a later project page is drawn live from its first frame: no poster to fetch)
  const [posterGone, setPosterGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setPosterGone(true), 450);
    return () => window.clearTimeout(t);
  }, [ready]);
  const stageRef = useRef<HTMLDivElement>(null);
  // house lights (a mode of this page): no stage is registered, so the canvas draws nothing
  const houseLights = useBooth((s) => s.houseLights);
  // C5: the home page's Index view: the booth is off on "/", like house lights, until 3D viewport
  const homeIndex = useBooth((s) => s.homeIndex) && mode === 'full';
  const live = mode !== 'off' && !houseLights && !homeIndex;
  useEffect(() => {
    document.documentElement.toggleAttribute('data-home-index', homeIndex);
  }, [homeIndex]);

  // Project pages: the sample goes on the tray. The lamp is never changed by a route: it stays
  // whatever the visitor picked (D50 until they pick); the native lamp is offered as a chip.
  useEffect(() => {
    setActiveSlug(mode === 'header' ? pathname.split('/')[2] : null);
  }, [pathname, mode, setActiveSlug]);
  // I3: a turned object faces front again when the route changes
  useEffect(() => resetSpins(), [pathname]);

  useEffect(() => {
    if (!live || !stageRef.current) return;
    return registerStage(stageRef.current);
  }, [live, mode]);

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
    const id = idle(() => {
      // J5: the booth's first frame is dark on a session's first visit (the tubes strike on ready)
      prepareOpening();
      setMounted(true);
    }, { timeout: 1200 });
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, [hasViews, mounted, mode]);

  return (
    <>
      <div className="booth-canvas" data-visible={hasViews} aria-hidden="true">
        {mounted && (
          <BoothCanvas
            onReady={() => {
              setReady(true);
              // C2 (08): the poster crossfades to the live booth (CSS, 300ms) once it is ready
              document.documentElement.setAttribute('data-booth-ready', '');
              logEvent('poster → canvas crossfade');
              runOpening((name) => playEvent(name as Parameters<typeof playEvent>[0]));
            }}
            lightmap={lightmap}
          />
        )}
      </div>
      {live && (
        <div ref={stageRef} className="booth-stage" data-mode={mode} data-ready={ready} aria-hidden="true">
          {/* P2 (09): the project header's placeholder is that sample's own tray shot, rendered from the
              live booth (tools/make-posters.mjs; the build refuses a stale one), crossfaded by the same
              reveal gate as the home poster, never a flat grey block */}
          {mode === 'header' && !posterGone && (
            <picture className="booth-poster booth-poster--tray">
              <source media="(max-width: 599px)" srcSet={`/booth/tray/${pathname.split('/')[2]}-phone.webp`} type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/booth/tray/${pathname.split('/')[2]}.webp`} alt="" fetchPriority="high" decoding="async" />
            </picture>
          )}
        </div>
      )}
    </>
  );
}
