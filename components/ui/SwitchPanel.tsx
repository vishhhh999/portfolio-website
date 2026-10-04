'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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

const FOLD_KEY = 'vm:panelFolded:v1';

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

  // D3: the panel floats bottom right; it folds to a pill showing the active lamp (kept per session)
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      setFolded(sessionStorage.getItem(FOLD_KEY) === '1');
    } catch {}
  }, []);
  const fold = (on: boolean) => {
    setFolded(on);
    try {
      sessionStorage.setItem(FOLD_KEY, on ? '1' : '0');
    } catch {}
  };

  if (!hasBooth) return null;
  const active = lampById(lamp);
  return (
    <nav className="panel" aria-label="Booth lamps" data-folded={folded} data-house={onIndex}>
      {folded ? (
        <button type="button" className="panel__pill" onClick={() => fold(false)} aria-expanded="false" aria-label={`Lamps: ${onIndex ? 'house lights on' : active.ariaLabel}. Show the lamp panel`}>
          <span className="panel__status-led" style={{ ['--lamp' as string]: onIndex ? '#f2f0ea' : active.indicator }} aria-hidden="true" />
          <span>{onIndex ? 'House lights' : active.label}</span>
          <span className="panel__pill-open" aria-hidden="true">＋</span>
        </button>
      ) : (
        <>
          <button type="button" className="rocker" aria-pressed={onIndex} onClick={toggleHouseLights} aria-keyshortcuts="I">
            <span className="rocker__state" aria-hidden="true">{onIndex ? 'On' : 'Off'}</span>
            <span>House lights</span>
            <kbd aria-hidden="true">I</kbd>
          </button>

          {/* House lights on: the booth is off, so the lamp bank folds away. */}
          {!onIndex && (
            <>
              <p className="panel__active mono" aria-live="polite">
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
                      aria-label={l.ariaLabel}
                      aria-keyshortcuts={l.key}
                      title={l.spec}
                      onClick={(e) => flip(l.id, e.clientX)}
                      style={{ ['--lamp' as string]: l.indicator }}
                    >
                      <span className="switch__led" aria-hidden="true" />
                      <span className="switch__label" aria-hidden="true">{l.id === 'AFTERDARK' ? 'Dark' : l.id}</span>
                      <span className="switch__readout" aria-hidden="true">{l.readout}</span>
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
          <button type="button" className="panel__fold" onClick={() => fold(true)} aria-expanded="true" aria-label="Fold the lamp panel">
            <span aria-hidden="true">−</span>
          </button>
        </>
      )}
    </nav>
  );
}
