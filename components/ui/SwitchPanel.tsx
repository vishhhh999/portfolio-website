'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LAMPS } from '@/lib/lampPresets';
import { readHouseLightsPreference, useBooth } from '@/lib/store';

/** The remembered house-lights choice is honoured on a fresh load only, never on in-app navigation. */
let preferenceChecked = false;

/**
 * Hardware-style lamp switches. Real buttons, aria-pressed, keys 1–7, I for house lights.
 * Phase 0: switches drive store state only. Lamps physically relight the booth in Phase 2.
 */
export function SwitchPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const lamp = useBooth((s) => s.lamp);
  const setLamp = useBooth((s) => s.setLamp);
  const houseLights = useBooth((s) => s.houseLights);
  const setHouseLights = useBooth((s) => s.setHouseLights);
  const sound = useBooth((s) => s.sound);
  const setSound = useBooth((s) => s.setSound);

  const onIndex = pathname === '/index';

  // Keep store in sync with the route, and honour a remembered house-lights choice.
  useEffect(() => {
    if (onIndex && !houseLights) setHouseLights(true);
    if (preferenceChecked) return;
    preferenceChecked = true;
    if (pathname === '/' && readHouseLightsPreference()) router.replace('/index');
  }, [onIndex, pathname, houseLights, setHouseLights, router]);

  const toggleHouseLights = () => {
    const next = !onIndex;
    setHouseLights(next);
    router.push(next ? '/index' : '/');
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
      const match = LAMPS.find((l) => l.key === e.key);
      if (match) setLamp(match.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <nav className="panel" aria-label="Booth lamps">
      <button
        type="button"
        className="rocker"
        aria-pressed={onIndex}
        onClick={toggleHouseLights}
        aria-keyshortcuts="I"
      >
        <span className="rocker__state" aria-hidden="true">{onIndex ? 'On' : 'Off'}</span>
        <span>House lights</span>
        <kbd aria-hidden="true">I</kbd>
      </button>

      {/* House lights on: the booth is off, so the lamp bank folds away. */}
      {!onIndex && (
        <>
          <ul className="switches" role="list">
            {LAMPS.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="switch"
                  aria-pressed={lamp === l.id}
                  aria-label={l.ariaLabel}
                  aria-keyshortcuts={l.key}
                  onClick={() => setLamp(l.id)}
                  style={{ ['--lamp' as string]: l.indicator }}
                >
                  <span className="switch__led" aria-hidden="true" />
                  <span className="switch__label" aria-hidden="true">{l.label}</span>
                  <span className="switch__readout" aria-hidden="true">{l.readout}</span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="sound" aria-pressed={sound} onClick={() => setSound(!sound)}>
            Sound {sound ? 'on' : 'off'}
          </button>
        </>
      )}
    </nav>
  );
}
