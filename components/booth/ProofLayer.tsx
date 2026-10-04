'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Mesh, NearestFilter, OrthographicCamera, RepeatWrapping, PlaneGeometry, Scene, ShaderMaterial, TextureLoader, VideoTexture, type Texture } from 'three';
import { onViewsChanged, planeEntries, planeRect } from '@/lib/views';
import { proofLayer } from './Post';
import { proofUniforms } from './proofUniforms';

/**
 * The AFTER DARK torch over a case-study image (C2). The image keeps its authored colour: no tone
 * mapping, bloom, colour matrix or tint ever touches it (these planes are drawn straight to the
 * screen after the booth's post chain). The torch is a pure luminance mask: a soft circle with a
 * smooth falloff, applied in linear light, multiplier exactly 1.0 at the centre and never above,
 * computed in float in the shader and dithered with blue noise where it is below 1 (no rings, no
 * clipped core, no 8-bit steps). At the centre the output is the file's own pixel.
 */
function torchMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      uSpot: proofUniforms.uSpot,
      uOutside: proofUniforms.uSpotOutside,
      uLevel: proofUniforms.uTorchLevel,
      uBlueNoise: { value: blueNoise() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map, uBlueNoise;
      uniform vec4 uSpot; // centre.xy (buffer px), radius px, softness
      uniform float uOutside, uLevel;
      varying vec2 vUv;
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
      void main() {
        vec3 file = texture2D(map, vUv).rgb; // the file's sRGB values, not decoded by the sampler
        float d = distance(gl_FragCoord.xy, uSpot.xy) / max(uSpot.z, 1.0);
        // smooth falloff from a flat core (exactly 1.0) to the edge; smootherstep has no visible knee
        float t = clamp((d - (1.0 - uSpot.w)) / max(uSpot.w, 1e-3), 0.0, 1.0);
        float m = 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
        float k = min(1.0, mix(uOutside, 1.0, m) * uLevel);
        if (k >= 1.0) { gl_FragColor = vec4(file, 1.0); return; }
        vec3 o = toSRGB(toLinear(file) * k);
        float n = texture2D(uBlueNoise, gl_FragCoord.xy / 64.0).r - 0.5;
        gl_FragColor = vec4(clamp(o + n / 255.0, 0.0, 1.0), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

let noiseTex: Texture | null = null;
/** 64×64 blue-noise tile (tools/gen-bluenoise.py), nearest-sampled and repeated in screen pixels. */
function blueNoise() {
  if (!noiseTex) {
    noiseTex = new TextureLoader().load('/textures/bluenoise64.png');
    noiseTex.wrapS = noiseTex.wrapT = RepeatWrapping;
    noiseTex.magFilter = noiseTex.minFilter = NearestFilter;
    noiseTex.generateMipmaps = false;
  }
  return noiseTex;
}

type PlaneObj = {
  mesh: Mesh | null;
  ready: boolean;
  announced: boolean;
  base?: ShaderMaterial;
  map?: Texture;
};

/**
 * The AFTER DARK proof layer: one screen-space plane per registered deliverable, placed every frame
 * from the cached layout and the shared scroll value. Planes only exist while AFTER DARK is on
 * (ProofStrip registers them); under every other lamp the images are the plain DOM files.
 */
export function ProofLayer() {
  const invalidate = useThree((s) => s.invalidate);
  const scene = useMemo(() => new Scene(), []);
  const camera = useMemo(() => new OrthographicCamera(0, 1, 0, -1, -10, 10), []);
  const geo = useMemo(() => new PlaneGeometry(1, 1), []);
  const objs = useRef(new Map<number, PlaneObj>());
  const loader = useMemo(() => new TextureLoader(), []);
  const createRef = useRef<(id: number) => void>(() => {});

  useEffect(() => {
    proofLayer.scene = scene;
    proofLayer.camera = camera;
    return () => {
      proofLayer.scene = null;
      proofLayer.camera = null;
    };
  }, [scene, camera]);

  useEffect(() => {
    const sync = () => {
      const entries = planeEntries();
      for (const [id, o] of objs.current) {
        if (!entries.has(id)) {
          if (o.mesh) scene.remove(o.mesh);
          o.base?.dispose();
          o.map?.dispose();
          objs.current.delete(id);
        }
      }
      for (const [id, spec] of entries) {
        if (objs.current.has(id)) continue;
        // created lazily, once the frame comes within a viewport of the screen (see useFrame)
        objs.current.set(id, { mesh: null, ready: false, announced: false });
      }
      invalidate();
    };
    createRef.current = (id: number) => {
      const spec = planeEntries().get(id);
      const obj = objs.current.get(id);
      if (!spec || !obj || obj.mesh) return;
      let map: Texture;
      if (spec.kind === 'video') {
        const v = spec.el as HTMLVideoElement;
        map = new VideoTexture(v); // raw sRGB values: the shader masks the file as it is
        const ready = () => {
          obj.ready = true;
          invalidate();
        };
        if (v.readyState >= 2) ready();
        else v.addEventListener('loadeddata', ready, { once: true });
      } else {
        const url = (spec.el as HTMLImageElement).currentSrc || spec.src;
        map = loader.load(url, () => {
          obj.ready = true;
          invalidate();
        });
        map.anisotropy = 8;
      }
      obj.map = map;
      obj.base = torchMaterial(map);
      obj.mesh = new Mesh(geo, obj.base);
      obj.mesh.visible = false;
      obj.mesh.frustumCulled = false;
      scene.add(obj.mesh);
    };
    sync();
    return onViewsChanged(sync);
  }, [scene, geo, loader, invalidate]);

  const drift = useMemo(() => (typeof window !== 'undefined' && window.location.search.includes('drift') ? { max: 0, frames: 0 } : null), []);
  useEffect(() => {
    if (drift) (window as unknown as { __boothDrift: () => typeof drift }).__boothDrift = () => drift;
  }, [drift]);

  useFrame(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    camera.left = 0;
    camera.right = W;
    camera.top = 0;
    camera.bottom = -H;
    camera.updateProjectionMatrix();
    const entries = planeEntries();
    for (const [id, o] of objs.current) {
      const r = planeRect(id);
      if (!r) continue;
      // only frames within one viewport of the screen get a texture and a plane
      if (!o.mesh && r.top < 2 * H && r.top + r.height > -H) createRef.current(id);
      if (!o.mesh) continue;
      o.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0);
      o.mesh.scale.set(r.width, r.height, 1);
      o.mesh.visible = o.ready && r.top < H && r.top + r.height > 0;
      // The plane has been drawn once (last frame): now the DOM element can step aside.
      if (o.ready && !o.announced && o.mesh.userData.drawn) {
        o.announced = true;
        entries.get(id)?.onReady?.();
      }
      if (o.mesh.visible) o.mesh.userData.drawn = true;
      if (drift && o.mesh.visible) {
        // ?drift: measure plane vs DOM position on the same tick (a layout read, debug only)
        const dom = entries.get(id)!.el.getBoundingClientRect();
        drift.max = Math.max(drift.max, Math.abs(dom.top - r.top), Math.abs(dom.left - r.left), Math.abs(dom.width - r.width));
        drift.frames++;
      }
      if (o.ready && !o.announced) invalidate();
    }
  });

  return null;
}
