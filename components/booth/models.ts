'use client';

import type { WebGLRenderer } from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isMobileTier } from '@/lib/perfTier';

/**
 * GLB loading for the booth objects (D1): GLTFLoader + MeshoptDecoder + KTX2Loader, created on the
 * first model request only. The Basis transcoder (public/basis/, self-hosted) is fetched by the
 * KTX2 loader when the first KTX2 texture needs it, never before.
 */
let loader: Promise<GLTFLoader> | null = null;
const cache = new Map<string, Promise<GLTF>>();

function getLoader(gl: WebGLRenderer) {
  loader ??= (async () => {
    const [{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/KTX2Loader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    ]);
    const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl);
    const l = new GLTFLoader();
    l.setKTX2Loader(ktx2);
    l.setMeshoptDecoder(MeshoptDecoder);
    return l;
  })();
  return loader;
}

/**
 * H4: models stream in view-priority order, two at a time. Priority < 10 is "needed for this view"
 * (the tray object on a project page, or the lineup left to right on home): loaded at once, and the
 * booth is revealed when they are in. Priority ≥ 10 (samples dimmed behind the tray) waits for the
 * browser to be idle. Nothing here blocks first paint: the canvas itself mounts after it.
 */
type Job = { url: string; priority: number; gl: WebGLRenderer; resolve: (g: GLTF) => void; reject: (e: unknown) => void };
const queue: Job[] = [];
let running = 0;
let pendingNeeded = 0;
const CONCURRENCY = 2;
const idle = (cb: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 300));
/**
 * H3: on phones the models a view does not need wait for the visitor's first scroll or touch, so a
 * project page costs only its tray object before scrolling (the 1.5MB budget).
 */
let engaged = typeof window === 'undefined' || !isMobileTier();
if (!engaged) {
  const go = () => {
    if (engaged) return;
    engaged = true;
    window.removeEventListener('scroll', go);
    window.removeEventListener('pointerdown', go);
    pump();
  };
  window.addEventListener('scroll', go, { passive: true });
  window.addEventListener('pointerdown', go, { passive: true });
}

function pump() {
  queue.sort((a, b) => a.priority - b.priority);
  while (running < CONCURRENCY && queue.length) {
    const job = queue[0];
    if (job.priority >= 10 && (pendingNeeded > 0 || !engaged)) return; // background models wait for the view's own
    queue.shift();
    running++;
    const start = () =>
      getLoader(job.gl)
        .then((l) => l.loadAsync(job.url))
        .then(job.resolve, job.reject)
        .finally(() => {
          running--;
          if (job.priority < 10) pendingNeeded--;
          pump();
        });
    if (job.priority >= 10) idle(start);
    else start();
  }
}

/** No model the current view needs is still loading (the booth is revealed only once they are in). */
export const modelsSettled = () => pendingNeeded === 0;

/** Load (once) and return a GLB, in view-priority order (lower first; ≥ 10 = when idle). */
export function loadModel(url: string, gl: WebGLRenderer, priority = 5): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    if (priority < 10) pendingNeeded++;
    p = new Promise<GLTF>((resolve, reject) => queue.push({ url, priority, gl, resolve, reject }));
    p.catch(() => {});
    cache.set(url, p);
    pump();
  }
  return p;
}
