'use client';

import { create } from 'zustand';
import { LAMP_IDS, type Lamp } from './types';

/** v2: the pre-paint script in app/layout.tsx reads the same key. */
export const HOUSE_LIGHTS_KEY = 'vm:houseLights:v2';
/** The visitor's own lamp pick, for this session (sessionStorage). Also read by the pre-paint script. */
export const LAMP_KEY = 'vm:lamp:v1';

/** The lamp the visitor picked this session, or D50. Routes never choose a lamp. */
export function readLampPreference(): Lamp {
  try {
    const v = sessionStorage.getItem(LAMP_KEY);
    if (v && (LAMP_IDS as readonly string[]).includes(v)) return v as Lamp;
  } catch {}
  return 'D50';
}

type BoothState = {
  lamp: Lamp;
  /** 0 to 1 while a lamp strikes. Driven by the lamp controller. */
  strikeProgress: number;
  /** The project on the tray (its page is open), or null at home. */
  activeSlug: string | null;
  /** The object under the pointer or keyboard focus: it lifts and shows its spec chip. */
  hoverSlug: string | null;
  /** House lights mode (lib/houseLights.ts sets it; <html data-house-lights> mirrors it). */
  houseLights: boolean;
  /** One quiet line when the booth stepped aside on its own (resilience), or null. */
  notice: string | null;
  sound: boolean;
  lampPicked: boolean;
  setLamp: (lamp: Lamp) => void;
  setStrikeProgress: (p: number) => void;
  setActiveSlug: (slug: string | null) => void;
  setHoverSlug: (slug: string | null) => void;
  setSound: (on: boolean) => void;
  setLampPicked: () => void;
};

export const useBooth = create<BoothState>((set) => ({
  lamp: 'D50',
  strikeProgress: 1,
  activeSlug: null,
  hoverSlug: null,
  houseLights: false,
  notice: null,
  sound: false,
  lampPicked: false,
  setLamp: (lamp) => set({ lamp }),
  setStrikeProgress: (strikeProgress) => set({ strikeProgress }),
  setActiveSlug: (activeSlug) => set({ activeSlug }),
  setHoverSlug: (hoverSlug) => set({ hoverSlug }),
  setSound: (sound) => set({ sound }),
  setLampPicked: () => set({ lampPicked: true }),
}));
