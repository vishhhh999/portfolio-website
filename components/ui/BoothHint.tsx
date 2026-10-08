'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBooth } from '@/lib/store';
import { useShape } from '@/lib/shape';

const KEY = 'vm:hint:v1';

/**
 * P5 (09): wayfinding on a first visit. Once the booth is revealed and the opening strike is over,
 * one quiet mono line under the booth says what it does; it fades after the first pointer, key or
 * touch input, or after 7 seconds. Once per session (sessionStorage vm:hint:v1), home only, never
 * during the strike, never in house lights. DOM text, aria-hidden (the page says the same in words),
 * absolutely placed so nothing shifts.
 */
export function BoothHint() {
  const pathname = usePathname();
  const opening = useBooth((s) => s.opening);
  const house = useBooth((s) => s.houseLights);
  const [state, setState] = useState<'wait' | 'on' | 'gone'>('wait');
  const [touch, setTouch] = useState(false);
  const tall = useShape((s) => s.shape) === 'tall';
  useEffect(() => setTouch(matchMedia('(pointer: coarse)').matches), []);
  useEffect(() => {
    if (pathname !== '/' || state !== 'wait' || opening || house) return;
    try {
      if (sessionStorage.getItem(KEY)) return setState('gone');
    } catch {}
    let t = 0;
    const tryShow = () => {
      if (!document.documentElement.hasAttribute('data-booth-ready')) return (t = window.setTimeout(tryShow, 400));
      try {
        sessionStorage.setItem(KEY, '1');
      } catch {}
      setState('on');
    };
    tryShow();
    return () => window.clearTimeout(t);
  }, [pathname, state, opening, house]);
  useEffect(() => {
    if (state !== 'on') return;
    const hide = () => setState('gone');
    const t = window.setTimeout(hide, 7000);
    // an input before the line has been up for a moment is the visitor already using the booth
    const evs = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    evs.forEach((e) => window.addEventListener(e, hide, { once: true, passive: true }));
    return () => {
      window.clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, hide));
    };
  }, [state]);
  if (pathname !== '/' || house) return null;
  return (
    <p className="boothhint mono" aria-hidden="true" data-on={state === 'on'}>
      {/* L3 (09B): the shelf scrolls with the page; a sideways drag turns a sample */}
      {touch ? (tall ? 'Tap to open. Drag sideways to turn.' : 'Tap to open. Drag to turn.') : 'Drag to turn. Click to open. 1 to 7 change the lamp.'}
    </p>
  );
}
