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
  /** 0 → 1 while a lamp strikes. Driven by the lamp controller. */
  strikeProgress: number;
  activeSlug: string | null;
  /** House lights mode (lib/houseLights.ts sets it; <html data-house-lights> mirrors it). */
  houseLights: boolean;
  /** One quiet line when the booth stepped aside on its own (resilience), or null. */
  notice: string | null;
  sound: boolean;
  /** The visitor has picked a lamp themselves. Until then proof-strip photos stay D50-faithful. */
  lampPicked: boolean;
  /** Mobile portrait crop: the sample the cabinet is panned to (swipe between samples). */
  focusSlug: string | null;
  /** A booth object focused from the keyboard (lifts and shows its spec chip, like a hover). */
  keySlug: string | null;
  /** C5: the home page's view, swapped in place by the nav (URL unchanged): the 3D booth or the Index list. */
  homeIndex: boolean;
  setHomeIndex: (on: boolean) => void;
  setLamp: (lamp: Lamp) => void;
  setStrikeProgress: (p: number) => void;
  setActiveSlug: (slug: string | null) => void;
  setSound: (on: boolean) => void;
  setLampPicked: () => void;
  setFocusSlug: (slug: string | null) => void;
  setKeySlug: (slug: string | null) => void;
};

export const useBooth = create<BoothState>((set) => ({
  lamp: 'D50',
  strikeProgress: 1,
  activeSlug: null,
  houseLights: false,
  notice: null,
  sound: false,
  lampPicked: false,
  focusSlug: null,
  keySlug: null,
  homeIndex: false,
  setHomeIndex: (homeIndex) => set({ homeIndex }),
  setLamp: (lamp) => set({ lamp }),
  setStrikeProgress: (strikeProgress) => set({ strikeProgress }),
  setActiveSlug: (activeSlug) => set({ activeSlug }),
  setSound: (sound) => set({ sound }),
  setLampPicked: () => set({ lampPicked: true }),
  setFocusSlug: (focusSlug) => set({ focusSlug }),
  setKeySlug: (keySlug) => set({ keySlug }),
}));

