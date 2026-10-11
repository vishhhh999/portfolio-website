'use client';

import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * One GLTF loader for the whole site (meshopt geometry, WebP textures: no KTX2, no Basis wasm).
 * Home loads the light model set for every object; a project's own object then swaps to its
 * detailed model. Two downloads at a time, the visible view first.
 */
let loader: Promise<GLTFLoader> | null = null;
const cache = new Map<string, Promise<GLTF>>();
const queue: { url: string; priority: number; resolve: (g: GLTF) => void; reject: (e: unknown) => void }[] = [];
let running = 0;

function getLoader() {
  loader ??= Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/libs/meshopt_decoder.module.js')]).then(
    ([{ GLTFLoader }, { MeshoptDecoder }]) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
  );
  return loader;
}

function pump() {
  queue.sort((a, b) => a.priority - b.priority);
  while (running < 2 && queue.length) {
    const job = queue.shift()!;
    running++;
    getLoader()
      .then((l) => l.loadAsync(job.url))
      .then(job.resolve, job.reject)
      .finally(() => {
        running--;
        pump();
      });
  }
}

export function loadModel(url: string, priority = 5): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise<GLTF>((resolve, reject) => queue.push({ url, priority, resolve, reject }));
    p.catch(() => {});
    cache.set(url, p);
    pump();
  }
  return p;
}

let pending = 0;
const settledListeners = new Set<() => void>();
/** Track a model the first frame needs; the booth is revealed once none are pending. */
export function track<T>(p: Promise<T>): Promise<T> {
  pending++;
  const done = () => {
    pending--;
    if (!pending) settledListeners.forEach((f) => f());
  };
  p.then(done, done);
  return p;
}
export const modelsSettled = () => pending === 0;
export function onSettled(fn: () => void) {
  settledListeners.add(fn);
  return () => void settledListeners.delete(fn);
}
