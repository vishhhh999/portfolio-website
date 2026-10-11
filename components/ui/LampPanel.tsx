'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LAMPS, type LampPreset } from '@/lib/lampPresets';
import { pickLamp } from '@/lib/lampController';
import { enableSound, playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { setHouseLightsMode } from '@/lib/houseLights';
import { boothMode } from '@/components/booth/Booth';
import { useBooth } from '@/lib/store';

const SPOKEN: Record<string, string> = {
  D50: 'D50, daylight', TL84: 'TL84, store fluorescent', A: 'A, home tungsten', UV: 'UV, blacklight',
  FLOOD: 'Flood, stadium floodlight', SCREEN: 'Screen, lit by the device screens only', AFTERDARK: 'After Dark, hand lamp',
};

/** Announces lamp changes politely (never the first lamp on load). */
function Announcer({ lamp }: { lamp: string }) {
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

const short = (l: LampPreset) => (l.id === 'AFTERDARK' ? 'After Dark' : l.label.split(' ')[0]);

/**
 * The lamp switches: one docked bar at the bottom of the screen on pages with a booth. Seven lamps
 * (name and a quiet readout), keys 1 to 7; House lights as a plain on/off switch (key I); sound (S).
 */
export function LampPanel() {
  const pathname = usePathname();
  const lamp = useBooth((s) => s.lamp);
  const sound = useBooth((s) => s.sound);
  const house = useBooth((s) => s.houseLights);
  const hasBooth = boothMode(pathname) !== 'off';

  const flip = (id: LampPreset['id'], x?: number) => {
    if (id === useBooth.getState().lamp) return;
    playEvent(`switch:${id}`, x);
    pickLamp(id);
    track('Lamp picked', { lamp: id });
  };
  const toggleHouse = () => {
    const next = !useBooth.getState().houseLights;
    setHouseLightsMode(next, { remember: true });
    track('House lights toggled', { on: next });
  };
  const toggleSound = () => {
    const next = !useBooth.getState().sound;
    void enableSound(next);
    track('Sound toggled', { on: next });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !hasBooth) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'i' || e.key === 'I') return toggleHouse();
      if (e.key === 's' || e.key === 'S') return toggleSound();
      if (useBooth.getState().houseLights) return;
      const match = LAMPS.find((l) => l.key === e.key);
      if (match) flip(match.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // the bar sits in the page directly under the booth (a slot in the home frame or the project header), so it scrolls with the booth and never covers content
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!hasBooth) return setSlot(null);
    let raf = 0;
    const find = () => {
      const el = document.getElementById('lamp-slot');
      if (el) setSlot(el);
      else raf = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(raf);
  }, [hasBooth, pathname]);

  if (!hasBooth || !slot || !slot.isConnected) return null;
  return createPortal(
    <div className="lamps" data-house={house}>
      <Announcer lamp={house ? 'house' : lamp} />
      <div className="lamps__bank" role="group" aria-label="Lamps" aria-hidden={house} inert={house}>
        {LAMPS.map((l) => (
          <button
            key={l.id}
            type="button"
            className="lamp"
            aria-pressed={l.id === lamp}
            title={`${l.ariaLabel}, key ${l.key}`}
            style={{ ['--led' as string]: l.indicator }}
            onClick={(e) => flip(l.id, e.clientX)}
          >
            <span className="lamp__led" aria-hidden="true" />
            <span className="lamp__name">{short(l)}</span>
            <span className="lamp__readout">{l.readout}</span>
            <span className="sr-only">, {l.ariaLabel}, key {l.key}</span>
          </button>
        ))}
      </div>
      <div className="lamps__side">
        <button type="button" role="switch" aria-checked={house} className="toggle" onClick={toggleHouse} title="The flat, no-3D version of this page (key I)">
          <span className="toggle__track" aria-hidden="true"><span className="toggle__knob" /></span>
          <span>House lights</span>
        </button>
        <button type="button" role="switch" aria-checked={sound} className="toggle toggle--quiet" onClick={toggleSound} title="Sound (key S)">
          <span className="toggle__track" aria-hidden="true"><span className="toggle__knob" /></span>
          <span>Sound</span>
        </button>
      </div>
    </div>,
    slot,
  );
}
