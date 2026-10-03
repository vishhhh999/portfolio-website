'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LAMPS, lampById } from '@/lib/lampPresets';
import { switchLamp } from '@/lib/lampController';
import { CONTACT_MAILTO } from '@/lib/site';
import { enableSound, playClick } from '@/lib/sound';
import { readHouseLightsPreference, useBooth } from '@/lib/store';

/** The house-lights view. Never a route segment named "index": hosts normalise /index to the root page. */
export const HOUSE_LIGHTS_PATH = '/house-lights';

/** The remembered house-lights choice is honoured on a fresh load only, never on in-app navigation. */
let preferenceChecked = false;

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

  // Honour a remembered house-lights choice on a fresh load of the home page. Only a choice the
  // visitor made (the rocker or the I key) is ever stored; visiting the page by URL or link is not.
  useEffect(() => {
    if (preferenceChecked) return;
    preferenceChecked = true;
    if (pathname === '/' && readHouseLightsPreference()) router.replace(HOUSE_LIGHTS_PATH);
  }, [pathname, router]);

  const flip = (id: (typeof LAMPS)[number]['id']) => {
    playClick();
    switchLamp(id);
  };

  const toggleHouseLights = () => {
    const next = !onIndex;
    playClick();
    setHouseLights(next); // the visitor's own choice: remembered
    router.push(next ? HOUSE_LIGHTS_PATH : '/');
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
