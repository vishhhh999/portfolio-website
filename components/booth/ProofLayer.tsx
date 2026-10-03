'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  DataTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  VideoTexture,
  type Texture,
} from 'three';
import { onViewsChanged, planeEntries, planeRect } from '@/lib/views';
import { proofLayer } from './Post';
import { proofUniforms } from './proofUniforms';
import { uvUniforms } from './uvMaterial';

const black = (() => {
  const t = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

/**
 * A printed photograph under the booth's lamp. The image is display-referred,
 * so it is first lifted back through the inverse of the neutral tone curve:
 * under D50 at level 1 it comes out of the post chain looking exactly like the
 * file. Then the active lamp's print model lights it (colour, falloff, pool or
 * hand lamp), and the same fluorMask / uvInk slots as the 3D objects glow under UV.
 * The colour matrix and tone mapping are applied by the shared post pass.
 */
function printMaterial(map: Texture, fluor: Texture | null, ink: Texture | null, withUV: boolean) {
  return new ShaderMaterial({
    // the base variant has no UV code at all; the UV variant is compiled only once UV is on
    defines: withUV ? { PRINT_UV: '' } : {},
    uniforms: {
      ...proofUniforms,
      ...uvUniforms,
      map: { value: map },
      uFluorMask: { value: fluor ?? black },
      uUvInk: { value: ink ?? black },
      uHasUV: { value: fluor || ink ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map, uFluorMask, uUvInk, uCookie;
      uniform vec3 uColour, uFluorColor, uInkColor;
      uniform float uAmbient, uSpotMix, uSpotOutside, uUseCookie, uProofUV, uFluorGain, uInkGain, uHasUV, uFloor;
      uniform mat3 uNeutralize;
      uniform vec4 uGrad, uSpot;
      uniform vec2 uBuffer;
      varying vec2 vUv;

      // inverse of Khronos PBR Neutral's highlight compression (start 0.76)
      vec3 unNeutral(vec3 c) {
        c = min(c, vec3(0.985));
        float peak = max(c.r, max(c.g, c.b));
        if (peak <= 0.76) return c;
        float d = 0.24;
        float p = d * d / (1.0 - peak) - d + 0.76;
        return c * (p / peak);
      }

      void main() {
        vec3 base = unNeutral(texture2D(map, vUv).rgb);
        vec2 frag = gl_FragCoord.xy;
        vec2 c = frag / uBuffer * 2.0 - 1.0;
        float g = 1.0 - uGrad.z * (1.0 - (dot(normalize(uGrad.xy + 1e-5), c) * 0.5 + 0.5));
        float light = g;
        if (uSpotMix > 0.0) {
          float dist = distance(frag, uSpot.xy) / max(uSpot.z, 1.0);
          float pool = 1.0 - smoothstep(1.0 - uSpot.w, 1.0, dist);
          if (uUseCookie > 0.5) pool *= texture2D(uCookie, (frag - uSpot.xy) / (2.0 * uSpot.z) + 0.5).r * 1.25;
          light = mix(light, mix(uSpotOutside, 1.0, pool), uSpotMix);
        }
        vec3 lit = uColour * light + uAmbient;
        // readability floor: never let the print light's luminance drop below uFloor. Below it, the
        // light keeps a tint of the lamp but mostly neutral: a saturated violet scaled up to the floor
        // would turn into a wash (blue carries little luminance).
        float y = dot(lit, vec3(0.2126, 0.7152, 0.0722));
        if (y < uFloor) {
          vec3 hue = y > 1e-4 ? lit / y : vec3(1.0);
          vec3 tint = mix(vec3(1.0), hue, 0.3);
          lit = tint / dot(tint, vec3(0.2126, 0.7152, 0.0722)) * uFloor;
        }
        vec3 col = base * lit;
        #ifdef PRINT_UV
          col += uProofUV * (uFluorGain * uFluorColor * texture2D(uFluorMask, vUv).rgb + uInkGain * uInkColor * texture2D(uUvInk, vUv).r);
        #endif
        gl_FragColor = vec4(max(uNeutralize * col, 0.0), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

type PlaneObj = {
  mesh: Mesh | null;
  ready: boolean;
  announced: boolean;
  base?: ShaderMaterial;
  uv?: ShaderMaterial;
  uvMaps?: [Texture | null, Texture | null];
  hasUV: boolean;
  map?: Texture;
};

/**
 * The proof-strip layer: one screen-space plane per registered deliverable,
 * placed every frame from the cached layout and the shared scroll value.
 */
export function ProofLayer() {
  const gl = useThree((s) => s.gl);
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
    const load = (url: string | undefined, srgb = false) => {
      if (!url) return null;
      const t = loader.load(url, () => invalidate());
      if (srgb) t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const sync = () => {
      const entries = planeEntries();
      for (const [id, o] of objs.current) {
        if (!entries.has(id)) {
          if (o.mesh) scene.remove(o.mesh);
          o.base?.dispose();
          o.uv?.dispose();
          o.map?.dispose();
          objs.current.delete(id);
        }
      }
      for (const [id, spec] of entries) {
        if (objs.current.has(id)) continue;
        // created lazily, once the frame comes within a viewport of the screen (see useFrame)
        objs.current.set(id, { mesh: null, ready: false, announced: false, hasUV: !!(spec.fluorMask || spec.uvInk) });
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
        map = new VideoTexture(v);
        map.colorSpace = SRGBColorSpace;
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
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = 8;
      }
      obj.map = map;
      obj.base = printMaterial(map, null, null, false);
      if (obj.hasUV) obj.uvMaps = [load(spec.fluorMask, true), load(spec.uvInk)];
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
    const dpr = gl.getPixelRatio();
    proofUniforms.uBuffer.value.set(W * dpr, H * dpr);
    const entries = planeEntries();
    const wantUV = proofUniforms.uProofUV.value > 0.001;
    for (const [id, o] of objs.current) {
      const r = planeRect(id);
      if (!r) continue;
      // only frames within one viewport of the screen get a texture and a plane
      if (!o.mesh && r.top < 2 * H && r.top + r.height > -H) createRef.current(id);
      if (!o.mesh) continue;
      if (o.hasUV && wantUV && !o.uv && o.map && o.uvMaps) o.uv = printMaterial(o.map, o.uvMaps[0], o.uvMaps[1], true);
      const mat = o.hasUV && wantUV && o.uv ? o.uv : o.base!;
      if (o.mesh.material !== mat) o.mesh.material = mat;
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
