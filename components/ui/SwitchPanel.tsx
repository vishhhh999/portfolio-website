'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LAMPS, lampById } from '@/lib/lampPresets';
import { pickLamp } from '@/lib/lampController';
import { CONTACT_MAILTO } from '@/lib/site';
import { bedLevel, enableSound, houseLightsSound, playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { declineAutoHouseLights } from '@/lib/resilience';
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

/** The house-lights view. Never a route segment named "index": hosts normalise /index to the root page. */
export const HOUSE_LIGHTS_PATH = '/house-lights';

/**
 * Hardware-style lamp switches. Real buttons, aria-pressed, keys 1–7, I for house lights.
 */
export function SwitchPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const lamp = useBooth((s) => s.lamp);
  const setHouseLights = useBooth((s) => s.setHouseLights);
  const sound = useBooth((s) => s.sound);

  const onIndex = pathname === HOUSE_LIGHTS_PATH;

  // A remembered house-lights choice is honoured before first paint by the inline script in
  // app/layout.tsx (fresh loads of / only). Only the rocker or the I key ever stores it.

  const flip = (id: (typeof LAMPS)[number]['id'], x?: number) => {
    if (id === useBooth.getState().lamp) return;
    playEvent(`switch:${id}`, x);
    pickLamp(id); // the visitor's own choice: remembered for the session, proofs follow it
    track('Lamp picked', { lamp: id });
  };

  const toggleHouseLights = () => {
    const next = !onIndex;
    if (!next) declineAutoHouseLights();
    houseLightsSound(next);
    setHouseLights(next); // the visitor's own choice: remembered
    track('House lights toggled', { on: next });
    router.push(next ? HOUSE_LIGHTS_PATH : '/');
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

  return (
    <nav className="panel" aria-label="Booth lamps">
      <button type="button" className="rocker" aria-pressed={onIndex} onClick={toggleHouseLights} aria-keyshortcuts="I">
        <span className="rocker__state" aria-hidden="true">{onIndex ? 'On' : 'Off'}</span>
        <span>House lights</span>
        <kbd aria-hidden="true">I</kbd>
      </button>

      {/* House lights on: the booth is off, so the lamp bank folds away. */}
      {!onIndex && (
        <>
          <p className="panel__status" aria-live="polite">
            <span className="panel__status-led" style={{ ['--lamp' as string]: lampById(lamp).indicator }} aria-hidden="true" />
            {lampById(lamp).spec}
          </p>
          <ul className="switches" role="list">
            {LAMPS.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="switch"
                  aria-pressed={lamp === l.id}
                  aria-label={l.ariaLabel}
                  aria-keyshortcuts={l.key}
                  onClick={(e) => flip(l.id, e.clientX)}
                  style={{ ['--lamp' as string]: l.indicator }}
                >
                  <span className="switch__led" aria-hidden="true" />
                  <span className="switch__label" aria-hidden="true">{l.label}</span>
                  <span className="switch__readout" aria-hidden="true">{l.readout}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="panel__foot">
            <button type="button" className="sound" aria-pressed={sound} onClick={toggleSound} aria-keyshortcuts="S">
              <span>Sound {sound ? 'on' : 'off'}</span>
              <SoundMeter on={sound} />
            </button>
            <a className="panel__contact" href={CONTACT_MAILTO}>Book a viewing ↗</a>
          </div>
        </>
      )}
    </nav>
  );
}
