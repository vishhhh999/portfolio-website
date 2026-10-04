'use client';

import type { WebGLRenderer } from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

let pending = 0;
/** No model still loading (the booth is revealed only once its objects are in: no half-built pop). */
export const modelsSettled = () => pending === 0;

/** Load (once) and return a GLB. */
export function loadModel(url: string, gl: WebGLRenderer): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    pending++;
    p = getLoader(gl).then((l) => l.loadAsync(url));
    p.finally(() => pending--).catch(() => {});
    cache.set(url, p);
  }
  return p;
}
