'use client';

import { create } from 'zustand';
import type { Lamp } from './types';

const HOUSE_LIGHTS_KEY = 'vm:houseLights';

type BoothState = {
  lamp: Lamp;
  /** 0 → 1 while a lamp strikes. Driven by GSAP in Phase 2. */
  strikeProgress: number;
  activeSlug: string | null;
  houseLights: boolean;
  sound: boolean;
  setLamp: (lamp: Lamp) => void;
  setStrikeProgress: (p: number) => void;
  setActiveSlug: (slug: string | null) => void;
  setHouseLights: (on: boolean) => void;
  setSound: (on: boolean) => void;
};

export const useBooth = create<BoothState>((set) => ({
  lamp: 'D50',
  strikeProgress: 1,
  activeSlug: null,
  houseLights: false,
  sound: false,
  setLamp: (lamp) => set({ lamp }),
  setStrikeProgress: (strikeProgress) => set({ strikeProgress }),
  setActiveSlug: (activeSlug) => set({ activeSlug }),
  setHouseLights: (houseLights) => {
    try {
      localStorage.setItem(HOUSE_LIGHTS_KEY, houseLights ? '1' : '0');
    } catch {}
    set({ houseLights });
  },
  setSound: (sound) => set({ sound }),
}));

export function readHouseLightsPreference(): boolean {
  try {
    return localStorage.getItem(HOUSE_LIGHTS_KEY) === '1';
  } catch {
    return false;
  }
}
