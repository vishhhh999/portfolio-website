'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LAMPS, lampById } from '@/lib/lampPresets';
import { switchLamp } from '@/lib/lampController';
import { CONTACT_MAILTO } from '@/lib/site';
import { enableSound, playClick } from '@/lib/sound';
import { readHouseLightsPreference, useBooth } from '@/lib/store';

/** The remembered house-lights choice is honoured on a fresh load only, never on in-app navigation. */
let preferenceChecked = false;

/**
 * Hardware-style lamp switches. Real buttons, aria-pressed, keys 1–7, I for house lights.
 */
export function SwitchPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const lamp = useBooth((s) => s.lamp);
  const houseLights = useBooth((s) => s.houseLights);
  const setHouseLights = useBooth((s) => s.setHouseLights);
  const sound = useBooth((s) => s.sound);

  const onIndex = pathname === '/index';

  // Keep store in sync with the route, and honour a remembered house-lights choice.
  useEffect(() => {
    if (onIndex && !houseLights) setHouseLights(true);
    if (preferenceChecked) return;
    preferenceChecked = true;
    if (pathname === '/' && readHouseLightsPreference()) router.replace('/index');
  }, [onIndex, pathname, houseLights, setHouseLights, router]);

  const flip = (id: (typeof LAMPS)[number]['id']) => {
    playClick();
    switchLamp(id);
  };

  const toggleHouseLights = () => {
    const next = !onIndex;
    playClick();
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
                  onClick={() => flip(l.id)}
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
            <button type="button" className="sound" aria-pressed={sound} onClick={() => void enableSound(!sound)}>
              Sound {sound ? 'on' : 'off'}
            </button>
            <a className="panel__contact" href={CONTACT_MAILTO}>Book a viewing ↗</a>
          </div>
        </>
      )}
    </nav>
  );
}
