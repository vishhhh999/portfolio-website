'use client';

import { useBooth } from './store';

/**
 * Booth sound: rocker click, TL84 ballast hum, UV buzz. Off by default.
 * Files live in /public/sounds and can be swapped for real recordings with
 * the same names (keep loops seamless: whole cycles, no fades at the ends).
 */
const FILES = { click: '/sounds/click.wav', hum: '/sounds/hum_tl84.wav', buzz: '/sounds/buzz_uv.wav' } as const;
const LOOP_LEVEL = { hum: 0.16, buzz: 0.1 } as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers: Partial<Record<keyof typeof FILES, AudioBuffer>> = {};
const loops: Partial<Record<'hum' | 'buzz', { gain: GainNode; src: AudioBufferSourceNode }>> = {};
let started = false;

async function init() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  await Promise.all(
    (Object.keys(FILES) as (keyof typeof FILES)[]).map(async (k) => {
      const res = await fetch(FILES[k]);
      buffers[k] = await ctx!.decodeAudioData(await res.arrayBuffer());
    }),
  );
}

function setLoop(name: 'hum' | 'buzz', on: boolean) {
  if (!ctx || !master || !buffers[name]) return;
  let loop = loops[name];
  if (!loop) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    const src = ctx.createBufferSource();
    src.buffer = buffers[name]!;
    src.loop = true;
    src.connect(gain);
    src.start();
    loop = loops[name] = { gain, src };
  }
  loop.gain.gain.setTargetAtTime(on ? LOOP_LEVEL[name] : 0, ctx.currentTime, 0.04);
}

export function playClick() {
  const { sound } = useBooth.getState();
  if (!sound || !ctx || !master || !buffers.click) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers.click;
  src.connect(master);
  src.start();
}

function sync() {
  const { sound, lamp } = useBooth.getState();
  setLoop('hum', sound && lamp === 'TL84');
  setLoop('buzz', sound && lamp === 'UV');
}

/** Called from the sound toggle (a user gesture, so the AudioContext may start). */
export async function enableSound(on: boolean) {
  useBooth.getState().setSound(on);
  if (on) {
    await init();
    await ctx?.resume();
    playClick();
  }
  if (!started) {
    started = true;
    useBooth.subscribe(sync);
  }
  sync();
}
