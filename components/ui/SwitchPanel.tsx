'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShape } from '@/lib/shape';
import { shelfLabelListeners, shelfLabelRects, tappedRect } from '@/components/booth/focus';
import { LAMPS, lampById } from '@/lib/lampPresets';
import { pickLamp } from '@/lib/lampController';
import { bedLevel, enableSound, playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { setHouseLightsMode } from '@/lib/houseLights';
import { boothMode } from '@/components/booth/BoothHost';
import { useRef } from 'react';
import { useBooth } from '@/lib/store';

/** A small level meter that moves with the ambient bed (only animates while sound is on). */
function SoundMeter({ on }: { on: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!on) {
      ref.current?.style.setProperty('--level', '0');
      return;
    }
    let id = 0;
    const tick = () => {
      ref.current?.style.setProperty('--level', bedLevel().toFixed(3));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [on]);
  return (
    <span ref={ref} className="sound__meter" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} style={{ ['--i' as string]: i }} />
      ))}
    </span>
  );
}

/** P8 (09): what a screen reader hears when the lamp changes (polite, focus never moves). */
const SPOKEN: Record<string, string> = {
  D50: 'D50, daylight',
  TL84: 'TL84, store fluorescent',
  A: 'A, home tungsten',
  UV: 'UV, blacklight',
  FLOOD: 'Flood, stadium floodlight',
  SCREEN: 'Screen, lit by the device screens only',
  AFTERDARK: 'After Dark, hand lamp',
  house: 'house lights on, the flat page',
};
/** P3 (09): the house-lights control names what it does, not "off" (which read as darkness). */
const HOUSE_TITLE = 'Switch this page to its flat, no-3D version';

/** P8 (09): announces lamp changes in an aria-live region (never the first lamp on load). */
function LampAnnouncer({ lamp }: { lamp: string }) {
  const first = useRef(true);
  const [text, setText] = useState('');
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setText(`Lamp: ${SPOKEN[lamp] ?? lamp}`);
  }, [lamp]);
  return (
    <span className="sr-only" aria-live="polite" aria-atomic="true">
      {text}
    </span>
  );
}

/**
 * Hardware-style lamp switches. Real buttons, aria-pressed, keys 1–7, I for house lights.
 * Only on pages with a booth (B4): /about, /archive, /house-lights and archive-only projects have
 * no 3D scene, so there is no panel there at all.
 */
export function SwitchPanel() {
  const pathname = usePathname();
  const lamp = useBooth((s) => s.lamp);
  const sound = useBooth((s) => s.sound);
  const onIndex = useBooth((s) => s.houseLights);
  const hasBooth = boothMode(pathname) !== 'off';

  // A remembered house-lights choice is honoured before first paint by the inline script in
  // app/layout.tsx. Only the rocker or the I key ever stores it. Never a navigation.

  const flip = (id: (typeof LAMPS)[number]['id'], x?: number) => {
    if (id === useBooth.getState().lamp) return;
    playEvent(`switch:${id}`, x);
    pickLamp(id); // the visitor's own choice: remembered for the session, proofs follow it
    track('Lamp picked', { lamp: id });
  };

  const toggleHouseLights = () => {
    const next = !useBooth.getState().houseLights;
    setHouseLightsMode(next, { remember: true }); // the visitor's own choice: remembered
    track('House lights toggled', { on: next });
  };

  const toggleSound = () => {
    const next = !useBooth.getState().sound;
    void enableSound(next);
    track('Sound toggled', { on: next });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!hasBooth) return;
      if (e.key === 'i' || e.key === 'I') {
        toggleHouseLights();
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        toggleSound();
        return;
      }
      if (onIndex) return;
      const match = LAMPS.find((l) => l.key === e.key);
      if (match) flip(match.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // C4: on home the panel sits in the flow under the booth (portalled into #panel-slot). On the other
  // booth pages it floats bottom centre as a pill that opens on hover or click, and folds back when
  // the page scrolls content under it.
  const home = pathname === '/';
  // L3 (09B): on the shelf (tall screens) the panel floats like on the project pages (the bottom rail
  // on phones, the centred pill on tablets), clear of the shelf's labels; elsewhere on home it sits in the flow
  const tallHome = useShape((s) => s.shape) === 'tall' && home;
  const inline = home && !tallHome;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(inline ? document.getElementById('panel-slot') : null);
  }, [inline, pathname]);
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  useEffect(() => {
    setOpen(false);
    pinned.current = false;
  }, [pathname]);
  useEffect(() => {
    if (inline || !open) return;
    const y0 = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - y0) > 24) {
        pinned.current = false;
        setOpen(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [inline, open]);

  // H3 (08): the folded pill stays centred and small, and never covers a proof. While the booth header
  // is on screen it rides the header's bottom edge (over the 3D view, not the proofs below it); past
  // the header it sits at the bottom of the viewport, slides away while the page scrolls down, and
  // comes back on a scroll up or after 1.2s still, only where no proof is under it
  const [away, setAway] = useState(false);
  const floating = !inline && !open;
  useEffect(() => {
    const nav = () => document.querySelector<HTMLElement>('.panel[data-place="float"]');
    if (!floating) {
      setAway(false);
      nav()?.style.removeProperty('--pill-lift');
      return;
    }
    let last = window.scrollY;
    let idle = 0;
    let raf = 0;
    const GAP = 12;
    /** Where the pill should sit: on the header's bottom edge while that edge is on screen. */
    const place = () => {
      const el = nav();
      if (!el) return { onHeader: false, top: 0, bottom: 0, left: 0, right: 0 };
      const h = el.offsetHeight;
      const stage = document.querySelector('.booth-stage')?.getBoundingClientRect();
      const base = window.innerHeight - GAP;
      const headerBottom = stage ? stage.bottom - GAP : Infinity;
      // the edge counts while it is in the lower two thirds of the screen; above that the pill drops to
      // the bottom slot (it would otherwise ride up into the nav)
      const onHeader = !!stage && headerBottom < base && headerBottom >= window.innerHeight * 0.35 && headerBottom - h > stage.top + GAP;
      const bottom = onHeader ? headerBottom : base;
      el.style.setProperty('--pill-lift', `${Math.round(window.innerHeight - bottom)}px`);
      const r = el.getBoundingClientRect();
      return { onHeader, top: bottom - h, bottom, left: r.left, right: r.right };
    };
    // F3 (09): the pill never sits on the calibration label, a proof or a link button
    const coversProof = (at: ReturnType<typeof place>) =>
      [...document.querySelectorAll('.proof__image, .calib, .livelink, .workend__card')].map((el) => el.getBoundingClientRect() as { top: number; bottom: number; left: number; right: number })
        // L3 (09B): on the shelf, its engraved labels and the sample a finger is on
        .concat([...shelfLabelRects.values()], tappedRect.r ? [tappedRect.r] : [])
        .some((p) => p.top < at.bottom && p.bottom > at.top && p.left < at.right && p.right > at.left);
    const settle = () => {
      const at = place();
      setAway(coversProof(at));
    };
    // the page scrolls smoothly (Lenis eases it for a while after each input), so the pill decides
    // every frame while the page moves, against the positions actually on screen
    let movingUntil = 0;
    const frame = (now: number) => {
      const y = window.scrollY;
      const dir = y - last;
      last = y;
      const at = place();
      if (coversProof(at)) setAway(true);
      else if (at.onHeader) setAway(false);
      else if (dir > 1) setAway(true);
      else if (dir < -1) setAway(false);
      raf = now < movingUntil ? requestAnimationFrame(frame) : 0;
    };
    const onScroll = () => {
      movingUntil = performance.now() + 800;
      if (!raf) raf = requestAnimationFrame(frame);
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 1200);
    };
    settle();
    // L3 (09B): the shelf's labels move with every frame it draws (and first appear after the panel
    // does): a panel that would sit on one steps away at once
    const onLabels = () => {
      if (coversProof(place())) setAway(true);
    };
    shelfLabelListeners.add(onLabels);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', settle);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', settle);
      shelfLabelListeners.delete(onLabels);
    };
  }, [floating, pathname]);

  if (!hasBooth) return null;
  if (inline && !slot) return null;
  const active = lampById(lamp);
  const folded = !inline && !open;
  const panel = (
    <nav
      className="panel"
      aria-label="Booth lamps"
      data-place={inline ? 'inline' : 'float'}
      data-folded={folded}
      data-away={folded && away}
      data-house={onIndex}
      onPointerEnter={(e) => {
        if (!inline && e.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (!inline && e.pointerType === 'mouse' && !pinned.current) setOpen(false);
      }}
    >
      {folded ? (
        <>
          <button
            type="button"
            className="panel__pill"
            onClick={() => {
              pinned.current = true;
              setOpen(true);
            }}
            aria-expanded="false"
            aria-label={`${onIndex ? 'House lights' : active.label}: show the lamp panel`}
          >
            <span className="panel__status-led" style={{ ['--lamp' as string]: onIndex ? '#f2f0ea' : active.indicator }} aria-hidden="true" />
            {/* P9 (09): the label crossfades (150ms) when the lamp changes */}
            <span key={onIndex ? 'house' : lamp} className="panel__pilllabel">{onIndex ? 'House lights' : active.label}</span>
          </button>
          {/* F1 (09): house lights is always one press away, also from the folded pill */}
          <button type="button" className="rocker rocker--pill" aria-pressed={onIndex} onClick={toggleHouseLights} aria-keyshortcuts="I" title={HOUSE_TITLE}>
            <kbd>I</kbd> <span className="rocker__state">{onIndex ? 'Flat' : 'Booth'}</span>
            <span className="sr-only">: house lights. {HOUSE_TITLE}</span>
          </button>
        </>
      ) : (
        <>
          <button type="button" className="rocker" aria-pressed={onIndex} onClick={toggleHouseLights} aria-keyshortcuts="I" title={HOUSE_TITLE}>
            <span>House lights</span> <span className="rocker__state">{onIndex ? 'Flat' : 'Booth'}</span> <kbd>I</kbd>
            <span className="sr-only">: {HOUSE_TITLE}</span>
          </button>

          {/* House lights on: the booth is off, so the lamp bank folds away. */}
          {!onIndex && (
            <>
              <p className="panel__active mono">
                <span className="panel__status-led" style={{ ['--lamp' as string]: active.indicator }} aria-hidden="true" />
                {active.label}
              </p>
              <ul className="switches" role="list">
                {LAMPS.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="switch"
                      aria-pressed={lamp === l.id}
                      aria-keyshortcuts={l.key}
                      title={l.spec}
                      onClick={(e) => flip(l.id, e.clientX)}
                      style={{ ['--lamp' as string]: l.indicator }}
                    >
                      <span className="switch__led" aria-hidden="true" />
                      <span className="switch__label">{l.id === 'AFTERDARK' ? 'Dark' : l.id}</span>{' '}
                      <span className="switch__readout">{l.readout}</span>
                      <span className="sr-only">: {l.ariaLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="sound" aria-pressed={sound} onClick={toggleSound} aria-keyshortcuts="S">
                <span>Sound {sound ? 'on' : 'off'}</span>
                <SoundMeter on={sound} />
              </button>
            </>
          )}
          {!inline && (
            <button
              type="button"
              className="panel__fold"
              onClick={() => {
                pinned.current = false;
                setOpen(false);
              }}
              aria-expanded="true"
              aria-label="Fold the lamp panel"
            >
              <span aria-hidden="true">−</span>
            </button>
          )}
        </>
      )}
      <LampAnnouncer lamp={onIndex ? 'house' : lamp} />
    </nav>
  );
  return inline ? createPortal(panel, slot!) : panel;
}
