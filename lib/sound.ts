'use client';

import { useBooth } from './store';
import type { Lamp } from './types';

/**
 * Booth sound (H). Everything is synthesised with Web Audio: no audio files, nothing downloaded,
 * ever (the old WAVs are gone). Off by default; the choice persists (localStorage vm:sound:v1).
 * The AudioContext is created on the first gesture after sound is enabled.
 *
 *   beds    one ambient bed per lamp, around −30 dBFS, layered noise and oscillators with slow
 *           random modulation (no short repeating buffers), crossfaded over 600ms on lamp change
 *   events  around −20 dBFS, panned by the screen position of whatever caused them
 *   bus     master gain → limiter (compressor at 20:1) → speakers; an analyser on the beds feeds
 *           the level meter in the switch panel
 *
 * Paused while the tab is hidden. In Safari the audio session is "ambient", so the iPhone's
 * silent switch is respected.
 */
export const SOUND_KEY = 'vm:sound:v1';

const BED_LEVEL = 0.0316; // −30 dBFS
const EVENT_LEVEL = 0.1; // −20 dBFS
const XFADE = 0.6;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bedBus: GainNode | null = null;
let eventBus: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let noise: AudioBuffer | null = null;
let current: { lamp: Lamp; out: GainNode; stop: () => void } | null = null;
let houseLightsSilence = false;
let subscribed = false;

const now = () => ctx!.currentTime;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 12s of white noise: long enough, and every bed reads it at a drifting rate through moving filters. */
function noiseBuffer() {
  if (noise) return noise;
  const len = ctx!.sampleRate * 12;
  noise = ctx!.createBuffer(2, len, ctx!.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = noise.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function noiseSource(rate = 1) {
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuffer();
  s.loop = true;
  s.loopStart = rand(0, 6);
  s.playbackRate.value = rate;
  s.start(now(), rand(0, 11));
  return s;
}

const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
};
const gain = (v: number) => {
  const g = ctx!.createGain();
  g.gain.value = v;
  return g;
};
const osc = (type: OscillatorType, freq: number) => {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start();
  return o;
};

/** Slow random modulation: every few seconds a param drifts toward a new random value. Never loops. */
function drift(param: AudioParam, lo: number, hi: number, every = [2.5, 6] as [number, number]) {
  let alive = true;
  const step = () => {
    if (!alive || !ctx) return;
    param.setTargetAtTime(rand(lo, hi), now(), rand(every[0], every[1]) / 2);
    window.setTimeout(step, rand(every[0], every[1]) * 1000);
  };
  step();
  return () => (alive = false);
}

/** A simple synthetic room: exponentially decaying stereo noise as an impulse response. */
function reverb(seconds: number, decay = 3) {
  const len = Math.floor(ctx!.sampleRate * seconds);
  const ir = ctx!.createBuffer(2, len, ctx!.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const cv = ctx!.createConvolver();
  cv.buffer = ir;
  return cv;
}

type Bed = { out: GainNode; stop: () => void };

/** One ambient bed per lamp. Each returns its output (at unity: the bus sets the level). */
function buildBed(lamp: Lamp): Bed {
  const out = gain(0);
  const stops: (() => void)[] = [];
  const nodes: AudioScheduledSourceNode[] = [];
  const keep = <T extends AudioScheduledSourceNode>(n: T) => (nodes.push(n), n);
  const roomTone = (cut: number, level: number) => {
    // brownish room tone: noise, low-passed, its level and colour drifting
    const n = keep(noiseSource(rand(0.9, 1.1)));
    const lp = filter('lowpass', cut, 0.5);
    const g = gain(level);
    n.connect(lp).connect(g).connect(out);
    stops.push(drift(lp.frequency, cut * 0.75, cut * 1.25), drift(g.gain, level * 0.8, level * 1.15));
    return g;
  };
  switch (lamp) {
    case 'D50': {
      roomTone(520, 0.8);
      // a faint, high electronic-ballast whine, very low
      const w = keep(osc('sine', 12400));
      const wg = gain(0.012);
      w.connect(wg).connect(out);
      stops.push(drift(w.frequency, 12350, 12450, [4, 9]));
      break;
    }
    case 'TL84': {
      roomTone(600, 0.6);
      // magnetic ballast hum: 100Hz and its harmonics, slightly gritty
      const h = keep(osc('sawtooth', 100));
      const hp = filter('lowpass', 650, 1.2);
      const hg = gain(0.22);
      h.connect(hp).connect(hg).connect(out);
      stops.push(drift(hg.gain, 0.17, 0.25), drift(hp.frequency, 520, 760));
      break;
    }
    case 'A': {
      // warm, near-silent room tone with a soft low-mid body
      roomTone(320, 0.7);
      const body = keep(noiseSource(0.5));
      const bp = filter('bandpass', 210, 1.4);
      const bg = gain(0.35);
      body.connect(bp).connect(bg).connect(out);
      stops.push(drift(bp.frequency, 180, 240));
      break;
    }
    case 'UV': {
      roomTone(400, 0.35);
      // 100Hz ballast buzz with harmonics and slow beating (two coils a hair apart)
      for (const f of [100, 100.6]) {
        const o = keep(osc('square', f));
        const lp = filter('lowpass', 900, 2);
        const g = gain(0.09);
        o.connect(lp).connect(g).connect(out);
      }
      // a touch of crackle: rare, short, quiet noise ticks
      const crackle = () => {
        if (!ctx || !alive) return;
        const t = now();
        const n = noiseSource(2);
        const hp = filter('highpass', 2500);
        const g = gain(0);
        n.connect(hp).connect(g).connect(out);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(rand(0.08, 0.2), t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.01, 0.03));
        n.stop(t + 0.05);
        window.setTimeout(crackle, rand(250, 1800));
      };
      let alive = true;
      crackle();
      stops.push(() => (alive = false));
      break;
    }
    case 'FLOOD': {
      // a bigger space: wider room tone into a long synthetic room, and distant air handling
      const space = reverb(2.6, 2.4);
      const wet = gain(0.6);
      const n = keep(noiseSource(0.8));
      const lp = filter('lowpass', 900, 0.5);
      const pre = gain(0.5);
      n.connect(lp).connect(pre);
      pre.connect(out);
      pre.connect(space).connect(wet).connect(out);
      stops.push(drift(lp.frequency, 700, 1100));
      const hum = keep(osc('triangle', 58));
      const hg = gain(0.12);
      hum.connect(hg).connect(out);
      stops.push(drift(hg.gain, 0.08, 0.16, [5, 10]));
      break;
    }
    case 'SCREEN': {
      // a soft device fan and a very quiet coil whine (well below 10kHz, never a CRT squeal)
      const fan = keep(noiseSource(1));
      const bp = filter('bandpass', 520, 0.8);
      const fg = gain(0.6);
      fan.connect(bp).connect(fg).connect(out);
      stops.push(drift(bp.frequency, 430, 640), drift(fg.gain, 0.45, 0.7));
      const coil = keep(osc('sine', 7600));
      const cg = gain(0.01);
      coil.connect(cg).connect(out);
      stops.push(drift(coil.frequency, 7400, 7900, [3, 7]));
      break;
    }
    case 'AFTERDARK': {
      // near silence: a very low night room tone and crickets far off
      roomTone(300, 1.6);
      const far = filter('lowpass', 5200, 0.5);
      const space = reverb(1.8, 3);
      const cg = gain(0.18);
      far.connect(space).connect(cg).connect(out);
      let alive = true;
      const chirp = () => {
        if (!ctx || !alive) return;
        // an Indian field cricket: a train of 3–5 short pulses at ~4.6kHz, every 0.5–1.4s
        const t0 = now() + 0.02;
        const f = rand(4400, 4900);
        const pulses = Math.floor(rand(3, 6));
        for (let i = 0; i < pulses; i++) {
          const t = t0 + i * 0.04;
          const o = ctx.createOscillator();
          o.frequency.value = f;
          const g = gain(0);
          o.connect(g).connect(far);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(rand(0.08, 0.16), t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
          o.start(t);
          o.stop(t + 0.04);
        }
        window.setTimeout(chirp, rand(500, 1400));
      };
      chirp();
      stops.push(() => (alive = false));
      // the torch's own small hum, while it is on
      const th = keep(osc('triangle', 120));
      const tg = gain(0.12);
      th.connect(filter('lowpass', 400)).connect(tg).connect(out);
      break;
    }
  }
  return {
    out,
    stop: () => {
      stops.forEach((s) => s());
      for (const n of nodes) {
        try {
          n.stop();
        } catch {}
      }
      out.disconnect();
    },
  };
}

function ensureContext() {
  if (ctx) return ctx;
  ctx = new AudioContext({ latencyHint: 'interactive' });
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master = gain(1);
  bedBus = gain(BED_LEVEL);
  eventBus = gain(EVENT_LEVEL);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  bedBus.connect(analyser);
  bedBus.connect(master);
  eventBus.connect(master);
  master.connect(limiter).connect(ctx.destination);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (useBooth.getState().sound) void ctx.resume();
  });
  return ctx;
}

/** Crossfade to the bed of the active lamp (600ms); silence under house lights. */
function syncBed() {
  if (!ctx || !bedBus) return;
  const { sound, lamp } = useBooth.getState();
  const want = sound && !houseLightsSilence ? lamp : null;
  if (current && current.lamp === want) return;
  const t = now();
  if (current) {
    const old = current;
    old.out.gain.cancelScheduledValues(t);
    old.out.gain.setValueAtTime(old.out.gain.value, t);
    old.out.gain.linearRampToValueAtTime(0, t + XFADE);
    window.setTimeout(() => old.stop(), XFADE * 1000 + 100);
    current = null;
  }
  if (want) {
    const bed = buildBed(want);
    bed.out.connect(bedBus);
    bed.out.gain.setValueAtTime(0, t);
    bed.out.gain.linearRampToValueAtTime(1, t + XFADE);
    current = { lamp: want, ...bed };
  }
}

/** Level of the bed right now, 0–1 (for the panel's meter). */
export function bedLevel() {
  if (!analyser || !ctx || ctx.state !== 'running') return 0;
  const d = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(d);
  let s = 0;
  for (const v of d) s += v * v;
  const rms = Math.sqrt(s / d.length);
  // −66 dBFS → 0, −24 dBFS → 1
  const db = 20 * Math.log10(rms + 1e-9);
  return Math.max(0, Math.min(1, (db + 66) / 42));
}

// ── events ─────────────────────────────────────────────────────────────────────────────────

export type SoundEvent =
  | 'switch:D50'
  | 'switch:TL84'
  | 'switch:A'
  | 'switch:UV'
  | 'switch:FLOOD'
  | 'switch:SCREEN'
  | 'switch:AFTERDARK'
  | 'breakerOn'
  | 'breakerOff'
  | 'hover'
  | 'select'
  | 'swipe'
  | 'route'
  | 'stamp'
  | 'paperFeed'
  | 'loupe'
  | 'beep'
  | 'toggle';

/** A short filtered noise burst. */
function burst(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, level: number, q = 1) {
  const n = noiseSource(rand(0.9, 1.1));
  const f = filter(type, freq, q);
  const g = gain(0);
  n.connect(f).connect(g).connect(dest);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + Math.min(0.004, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.stop(t + dur + 0.05);
}
/** A short pitched thump or tone with an exponential decay. */
function tone(dest: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, level: number) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = gain(0);
  o.connect(g).connect(dest);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function play(name: SoundEvent, dest: AudioNode) {
  const t = now() + 0.005;
  switch (name) {
    case 'toggle':
    case 'switch:A':
      // a rocker: two clicks, the second heavier
      burst(dest, t, 0.012, 'bandpass', 3200, 0.6, 2);
      burst(dest, t + 0.03, 0.02, 'bandpass', 1800, 0.9, 1.5);
      if (name === 'switch:A') tone(dest, t + 0.03, 0.05, 'sine', 900, 600, 0.08); // the filament ticks on
      break;
    case 'switch:D50':
    case 'switch:TL84':
      // the starter: a tick, the tube's strike, and a ballast buzz rising with the flickers (≈250ms)
      burst(dest, t, 0.01, 'highpass', 4000, 0.5);
      burst(dest, t + 0.05, 0.03, 'bandpass', 1200, 0.5, 1);
      tone(dest, t + 0.06, 0.25, 'sawtooth', 100, 100, name === 'switch:TL84' ? 0.12 : 0.07);
      burst(dest, t + 0.13, 0.015, 'highpass', 3000, 0.25);
      break;
    case 'switch:UV':
      // the ballast thunk, then its buzz coming up over the 600ms fade
      tone(dest, t, 0.12, 'sine', 140, 60, 0.6);
      {
        const o = ctx!.createOscillator();
        o.type = 'square';
        o.frequency.value = 100;
        const lp = filter('lowpass', 700);
        const g = gain(0);
        o.connect(lp).connect(g).connect(dest);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.start(t);
        o.stop(t + 1);
      }
      break;
    case 'switch:FLOOD':
      // a heavy contactor: a low thump and a metallic transient, all at once
      tone(dest, t, 0.25, 'sine', 90, 40, 0.9);
      burst(dest, t, 0.06, 'bandpass', 2400, 0.7, 4);
      burst(dest, t + 0.004, 0.18, 'lowpass', 400, 0.4);
      break;
    case 'switch:SCREEN':
      // a soft power-on tone: two gentle notes, the screens first, the spill after
      tone(dest, t, 0.35, 'sine', 523, 523, 0.18);
      tone(dest, t + 0.12, 0.5, 'sine', 784, 784, 0.14);
      break;
    case 'switch:AFTERDARK':
      // cut to black, then the torch's clicky switch
      burst(dest, t + 0.22, 0.008, 'highpass', 5000, 0.9);
      burst(dest, t + 0.235, 0.012, 'bandpass', 2600, 0.6, 3);
      break;
    case 'breakerOn':
    case 'breakerOff':
      // a large breaker throw: a spring-loaded clack and a low body thump
      burst(dest, t, 0.02, 'bandpass', 1500, 1, 1.2);
      tone(dest, t + 0.01, 0.3, 'sine', 110, 45, 0.8);
      burst(dest, t + 0.02, 0.25, 'lowpass', 300, 0.35);
      break;
    case 'hover':
      // a soft felt tick
      burst(dest, t, 0.03, 'lowpass', 900, 0.25, 0.7);
      break;
    case 'select':
      // a card set down on a plinth: a soft low tap and a little paper
      tone(dest, t, 0.08, 'sine', 180, 90, 0.35);
      burst(dest, t, 0.09, 'bandpass', 2200, 0.25, 0.8);
      break;
    case 'swipe':
      // a short paper slide
      {
        const n = noiseSource(1);
        const bp = filter('bandpass', 1400, 0.9);
        bp.frequency.setValueAtTime(900, t);
        bp.frequency.linearRampToValueAtTime(2600, t + 0.16);
        const g = gain(0);
        n.connect(bp).connect(g).connect(dest);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        n.stop(t + 0.25);
      }
      break;
    case 'route':
      // a booth door latch, quiet
      burst(dest, t, 0.015, 'bandpass', 2600, 0.3, 3);
      burst(dest, t + 0.045, 0.02, 'bandpass', 1700, 0.35, 2);
      tone(dest, t + 0.045, 0.1, 'sine', 160, 80, 0.15);
      break;
    case 'stamp':
      // a rubber stamp: a dull thump with a rubbery body
      tone(dest, t, 0.12, 'sine', 220, 70, 0.7);
      burst(dest, t, 0.07, 'lowpass', 1200, 0.5);
      break;
    case 'paperFeed':
      // a short paper feed: a ratcheting run of tiny ticks under a paper hiss
      for (let i = 0; i < 6; i++) burst(dest, t + i * 0.035, 0.012, 'bandpass', 3000, 0.25, 2);
      burst(dest, t, 0.25, 'bandpass', 2000, 0.2, 0.6);
      break;
    case 'loupe':
      // a loupe click
      burst(dest, t, 0.012, 'bandpass', 4200, 0.5, 4);
      break;
    case 'beep':
      // a tiny measurement beep
      tone(dest, t, 0.07, 'sine', 2093, 2093, 0.2);
      break;
  }
}

/** Play a named event, panned by the screen x of whatever caused it (if known). */
export function playEvent(name: SoundEvent | string, x?: number) {
  const { sound } = useBooth.getState();
  if (!sound || !ctx || !eventBus || ctx.state !== 'running') return;
  const pan = ctx.createStereoPanner();
  pan.pan.value = x === undefined ? 0 : Math.max(-0.8, Math.min(0.8, (x / window.innerWidth) * 2 - 1));
  pan.connect(eventBus);
  play(name as SoundEvent, pan);
  window.setTimeout(() => pan.disconnect(), 2000);
}

/** The rocker click under every switch (kept for callers that just need "a switch"). */
export const playClick = (x?: number) => playEvent('toggle', x);

/** House lights: a breaker, then every bed fades to silence (and the reverse). */
export function houseLightsSound(on: boolean) {
  playEvent(on ? 'breakerOn' : 'breakerOff');
  houseLightsSilence = on;
  window.setTimeout(syncBed, on ? 250 : 120);
}

function setAudioSessionAmbient() {
  // Safari: an ambient audio session respects the iPhone's silent switch
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  } catch {}
}

/** Called from the sound toggle (a user gesture, so the AudioContext may start). */
export async function enableSound(on: boolean) {
  useBooth.getState().setSound(on);
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {}
  if (on) {
    setAudioSessionAmbient();
    ensureContext();
    await ctx!.resume();
    playEvent('toggle');
  }
  if (!subscribed) {
    subscribed = true;
    useBooth.subscribe((s, prev) => {
      if (s.lamp !== prev.lamp || s.sound !== prev.sound) syncBed();
    });
  }
  syncBed();
}

/**
 * Restores a remembered "sound on": the store is set at once (the panel shows ON), and the audio
 * starts on the visitor's first gesture (browsers only allow audio after one).
 */
export function restoreSoundPreference() {
  let on = false;
  try {
    on = localStorage.getItem(SOUND_KEY) === '1';
  } catch {}
  if (!on) return;
  useBooth.getState().setSound(true);
  const start = () => {
    window.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', start);
    if (useBooth.getState().sound) void enableSound(true);
  };
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
}
