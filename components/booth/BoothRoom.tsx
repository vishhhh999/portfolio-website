'use client';

import { perfOff } from '@/lib/perfFlags';

import { MeshReflectorMaterial, RoundedBox, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Color,
  LinearSRGBColorSpace,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Group,
  type Material,
  type Mesh,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { isMobileTier } from '@/lib/perfTier';
import { useBooth } from '@/lib/store';
import { shellParts, type ShellPart } from './shell';
import { BOOTH, CABINET, CABINET_FACE, COVE, DIFFUSER, PLINTH_GREY, PROPS, STAGING, TRAY } from './staging';
import { applyUV } from './uvMaterial';
import { smudgeMap, wallRoughness } from './imperfections';

/** B5: Munsell N8 booth grey for the walls; the floor a satin step darker; plinths a warmer N8.5. */
export const BOOTH_GREY = '#C4C4C2';
const FLOOR_GREY = '#B5B5B3';
const CEILING_GREY = '#CDCDCB';

/**
 * Ceiling: lit only by bounce (no lamp faces it), so the rig sets its level and tint directly per
 * lamp. Avoids the area light's negative term behind its plane. Seen from inside.
 */
export const ceilingMaterial = new MeshBasicMaterial({ color: CEILING_GREY, toneMapped: true, side: BackSide });

/**
 * The opal diffuser (H). An opal acrylic sheet: it glows (emissive, colour and level from the lamp
 * rig, the map its internal falloff and tubes) only while its lamp is on (D50, TL84, A, FLOOD in
 * their colours; under UV only the violet tubes). Otherwise it is a pale surface that just
 * receives the scene's light (the screens' spill under SCREEN, the hand lamp under AFTER DARK).
 */
export const diffuserMaterial = new MeshStandardMaterial({ color: '#E6E5E0', roughness: 0.45, metalness: 0, emissive: '#000000', envMapIntensity: 0.3 });
/** The hood's bounce glow (H): set per lamp by the rig from the lamp's bounce light; zero in the dark lamps. */
export const hoodGlow = new Color(0, 0, 0);

// ── procedural surface textures (generated once, tiny) ─────────────────────────────────────

let noiseCache: Texture | null = null;
/**
 * Fine paper-like roughness variation: a 512² tile of very low amplitude value noise at three
 * scales, centred on mid grey (the material's roughness is the base, this modulates it ±6%).
 */
export function roughnessNoise() {
  if (noiseCache) return noiseCache;
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const img = g.createImageData(N, N);
  let s = 90210;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const octave = (cells: number) => {
    const grid = Array.from({ length: cells * cells }, rnd);
    return (x: number, y: number) => {
      const fx = (x / N) * cells, fy = (y / N) * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const at = (i: number, j: number) => grid[((j % cells) + cells) % cells * cells + (((i % cells) + cells) % cells)];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
    };
  };
  const o1 = octave(8), o2 = octave(32), o3 = octave(128);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = 0.5 * o1(x, y) + 0.3 * o2(x, y) + 0.2 * o3(x, y) + (rnd() - 0.5) * 0.12;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(128 + (v - 0.5) * 30);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  noiseCache = t;
  return t;
}

/**
 * The diffuser's internal falloff: an opal acrylic sheet lit from behind by tubes running across
 * the width. Brightest down the middle, falling off to the frame, with the tubes faintly visible
 * as soft brighter bands. `tubes` = how many (0: an even panel).
 */
function diffuserTexture(tubes: number, tubesOnly = false) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1), v = y / (H - 1);
      // falloff toward the frame: a soft rounded-rectangle vignette
      const ex = Math.min(u, 1 - u) * 2, ey = Math.min(v, 1 - v) * 2;
      let l = Math.pow(Math.min(1, ex * 3.2), 0.6) * Math.pow(Math.min(1, ey * 3.6), 0.6);
      l = 0.72 + 0.28 * l;
      let band = 0;
      for (let k = 0; k < tubes; k++) {
        const ty = (k + 0.5) / tubes;
        band += Math.exp(-Math.pow((v - ty) / 0.055, 2));
      }
      l = tubesOnly ? Math.min(1, band) * Math.pow(Math.min(1, ex * 6), 0.5) : l * (0.9 + 0.1 * Math.min(1, band));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * Math.min(1, l));
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

let aoTex: Texture | null = null;
/** The baked AO over the shell atlas (tools/bake-booth.mjs), sampled on uv1. */
export function shellAO() {
  if (aoTex) return aoTex;
  aoTex = new TextureLoader().load('/booth/ao.png');
  aoTex.channel = 1;
  aoTex.colorSpace = NoColorSpace;
  aoTex.minFilter = LinearMipmapLinearFilter;
  aoTex.magFilter = LinearFilter;
  return aoTex;
}

/**
 * Lightmap tint per lamp: a Blender bake of the shell is lit neutral white (bake indirect light
 * only; the realtime lamps still light the shell directly); the rig colours and levels it here.
 */
export const lightmapTint = { value: new Color(1, 1, 1) };

/** Uses a baked lightmap (uv1) on a shell material, tinted per lamp through lightmapTint. */
function applyLightmap(m: MeshStandardMaterial, map: Texture) {
  m.lightMap = map;
  m.lightMapIntensity = 1;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    shader.uniforms.uLightmapTint = lightmapTint;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLightmapTint;')
      .replace('vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;', 'vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity * uLightmapTint;');
  };
  m.needsUpdate = true;
}

let lightmapTex: Texture | null = null;
/** Loads the baked lightmap once (KTX2 through the model loader's transcoder, or PNG). */
async function loadLightmap(url: string, gl: WebGLRenderer): Promise<Texture> {
  if (lightmapTex) return lightmapTex;
  let t: Texture;
  if (url.endsWith('.ktx2')) {
    const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
    t = await new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl).loadAsync(url);
  } else t = await new TextureLoader().loadAsync(url);
  t.channel = 1;
  t.colorSpace = LinearSRGBColorSpace;
  t.flipY = false;
  lightmapTex = t;
  return t;
}

let partsCache: ShellPart[] | null = null;
/** The shell, built once (the same geometry the bake used). */
export function booth(lineup: string[]) {
  if (!partsCache) partsCache = shellParts(lineup);
  return partsCache;
}

// ── soft contact shadow (blob) for the cabinet on the page ─────────────────────────────────
function blobTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = Math.max(0, Math.abs(x - S / 2 + 0.5) / (S / 2) - 0.55) / 0.45;
      const dy = Math.max(0, Math.abs(y - S / 2 + 0.5) / (S / 2) - 0.55) / 0.45;
      const d = Math.min(1, Math.hypot(dx, dy));
      const a = Math.pow(1 - d, 2.2);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}
let blobMat: MeshBasicMaterial | null = null;
/** One shared material for every soft grounding shadow; the rig sets its opacity per lamp. */
export function getBlobMaterial() {
  if (!blobMat) blobMat = new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
  return blobMat;
}

/** Grounding shadow under a footprint (w × d), lying on the surface at local y = 0 (+1mm). */
export function ContactBlob({ w, d, spread = 1.35 }: { w: number; d: number; spread?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={getBlobMaterial()} renderOrder={1}>
      <planeGeometry args={[w * spread, d * spread]} />
    </mesh>
  );
}

// ── maker's plate ──────────────────────────────────────────────────────────────────────────
function plateTexture() {
  const W = 1024, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#d9d9d6');
  grad.addColorStop(1, '#bdbdba');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2) {
    g.fillStyle = `rgba(255,255,255,${0.04 + ((y * 7919) % 13) / 260})`;
    g.fillRect(0, y, W, 1);
  }
  g.strokeStyle = '#8d8d8a';
  g.lineWidth = 4;
  g.strokeRect(6, 6, W - 12, H - 12);
  // Two texts on one plate: the serial is drawn first and the title is fitted into the space left
  // (measured, so a wide fallback monospace can never run the title into the serial).
  g.fillStyle = '#2a2a28';
  g.textBaseline = 'middle';
  g.font = '500 32px ui-monospace, "DejaVu Sans Mono", monospace';
  g.textAlign = 'right';
  g.fillText('SN 0047', W - 40, H / 2 + 2);
  const room = W - 40 - g.measureText('SN 0047').width - 48 - 40;
  const title = 'VM VIEWING BOOTH · 7 ILLUMINANTS';
  let size = 46;
  g.font = `600 ${size}px ui-monospace, "DejaVu Sans Mono", monospace`;
  while (g.measureText(title).width > room && size > 18) g.font = `600 ${--size}px ui-monospace, "DejaVu Sans Mono", monospace`;
  g.textAlign = 'left';
  g.fillText(title, 40, H / 2 + 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ── materials ──────────────────────────────────────────────────────────────────────────────
type ShellMats = { interior: Material[]; frame: Material; housing: Material; hood: Material; lip: Material; shelf: Material };

function shellMaterials(mobile: boolean): ShellMats {
  const rough = roughnessNoise();
  const ao = shellAO();
  const wall = () => {
    // J3: slow wiped variation across the paint (the fine grain stays in the bump of the light)
    const r = wallRoughness().clone();
    r.repeat.set(2, 1.4);
    r.needsUpdate = true;
    return new MeshStandardMaterial({ color: BOOTH_GREY, roughness: 0.98, roughnessMap: r, aoMap: ao, aoMapIntensity: 1, side: BackSide, envMapIntensity: 0.35 });
  };
  const floor = new MeshStandardMaterial({
    // pushed back in depth: anything standing on the floor wins every depth tie
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
    color: FLOOR_GREY,
    roughness: mobile ? 0.42 : 0.5,
    roughnessMap: rough,
    aoMap: ao,
    side: BackSide,
    envMapIntensity: mobile ? 0.9 : 0.6,
  });
  const hidden = new MeshBasicMaterial({ visible: false });
  ceilingMaterial.aoMap = ao;
  return {
    // groups: +x (right wall), −x (left wall), +y (ceiling), −y (floor), +z (open front), −z (back wall)
    interior: [wall(), wall(), ceilingMaterial, floor, hidden, wall()],
    frame: new MeshPhysicalMaterial({ color: '#161618', metalness: 0.55, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 1 }),
    housing: new MeshStandardMaterial({ color: '#1B1B1A', roughness: 0.62, metalness: 0.3 }),
    // the lamp hood: satin N6, like the light housing of a real booth (not a black slab)
    hood: (() => {
      const m = new MeshStandardMaterial({ color: '#B4B4B2', roughness: 0.6, metalness: 0.05, roughnessMap: rough, side: DoubleSide });
      m.emissive = hoodGlow; // shared: the rig sets it per lamp (dark under UV, SCREEN, AFTER DARK)
      return m;
    })(),
    lip: new MeshStandardMaterial({ color: '#A2A2A0', roughness: 0.7, roughnessMap: rough, aoMap: ao }),
    shelf: new MeshStandardMaterial({ color: PLINTH_GREY, roughness: 0.88, roughnessMap: rough, aoMap: ao }),
  };
}

/** A base's material: N8 plinths, a clear acrylic riser (frosted on mobile), an anodised tray. */
export function baseMaterial(kind: 'plinth' | 'riser' | 'tray', mobile: boolean): Material {
  const m = baseMaterialFor(kind, mobile);
  // pushed back in depth: an object standing on its base wins every depth tie at the contact
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 2;
  return m;
}
function baseMaterialFor(kind: 'plinth' | 'riser' | 'tray', mobile: boolean): Material {
  if (kind === 'riser')
    return mobile
      ? new MeshPhysicalMaterial({ color: '#E9EDEE', roughness: 0.55, transmission: 0, transparent: true, opacity: 0.72, clearcoat: 0.6, envMapIntensity: 0.8 })
      : // J3: polished acrylic with a few fingerprints and hairline scratches in its gloss
        new MeshPhysicalMaterial({ color: '#F4F8F8', roughness: 0.3, roughnessMap: smudgeMap(), transmission: 1, thickness: 0.03, ior: 1.49, clearcoat: 1, clearcoatRoughness: 0.2, clearcoatRoughnessMap: smudgeMap(), envMapIntensity: 1 });
  if (kind === 'tray') return new MeshPhysicalMaterial({ color: '#5F5F5D', metalness: 0.6, roughness: 0.38, clearcoat: 0.2, envMapIntensity: 0.9 });
  const r = roughnessNoise();
  return new MeshStandardMaterial({ color: PLINTH_GREY, roughness: 0.9, roughnessMap: r, aoMap: shellAO(), envMapIntensity: 0.4 });
}

/**
 * The booth: a coved, open-fronted box (no 90° edge anywhere), an opal diffuser in the ceiling
 * behind a sloped hood, a chamfered satin black frame, the housing, a lip at the floor's front
 * edge with the maker's plate on the sill, the calibration shelf, and the soft shadow the cabinet
 * casts on the page. Desktop: a blurred, low-mix reflection on the satin floor.
 */
export function BoothRoom({ lineup, lightmap = null }: { lineup: string[]; lightmap?: string | null }) {
  const mobile = isMobileTier();
  const parts = booth(lineup);
  const mats = useMemo(() => shellMaterials(mobile), [mobile]);
  const plate = useMemo(plateTexture, []);
  const lamp = useBooth((s) => s.lamp);
  const tubes = lamp === 'TL84' ? 4 : lamp === 'D50' ? 3 : lamp === 'UV' ? 2 : 0;
  const difTex = useMemo(() => diffuserTexture(tubes, lamp === 'UV'), [tubes, lamp]);
  useEffect(() => {
    diffuserMaterial.emissiveMap = difTex;
    diffuserMaterial.needsUpdate = true;
  }, [difTex]);

  const gl = useThree((st) => st.gl);
  const invalidate = useThree((st) => st.invalidate);
  // a Blender lightmap of the shell, when one has been baked (decided at build time)
  useEffect(() => {
    if (!lightmap) return;
    let live = true;
    loadLightmap(lightmap, gl)
      .then((t) => {
        if (!live) return;
        const lit = [...mats.interior, mats.lip, mats.shelf, mats.hood].filter((m): m is MeshStandardMaterial => (m as MeshStandardMaterial).isMeshStandardMaterial);
        lit.forEach((m) => applyLightmap(m, t));
        invalidate();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [lightmap, gl, mats, invalidate]);

  const shell = parts.filter((p) => p.role !== 'base');
  const matFor = (p: ShellPart): Material | Material[] =>
    p.role === 'interior' ? mats.interior : p.role === 'diffuser' ? diffuserMaterial : p.role === 'frame' ? mats.frame : p.role === 'housing' ? mats.housing : p.role === 'hood' ? mats.hood : p.role === 'lip' ? mats.lip : mats.shelf;

  return (
    <group>
      {shell.map((p) => (
        <mesh
          key={p.name}
          name={p.name}
          geometry={p.geometry}
          material={matFor(p)}
          position={p.position}
          rotation={p.rotation ?? [0, 0, 0]}
          // B4: the cabinet's solid parts block picking (the walls are behind every sample)
          userData={{ occluder: p.role === 'frame' || p.role === 'housing' || p.role === 'hood' || p.role === 'lip' }}
          receiveShadow={p.role === 'interior' || p.role === 'lip' || p.role === 'shelf'}
          castShadow={p.role === 'lip' || p.role === 'shelf' || p.role === 'hood'}
        />
      ))}

      {!mobile && !perfOff('reflector') && <FloorReflection />}

      {/* maker's plate on the sill, 1mm proud of the frame's face */}
      <mesh position={[0.5, -CABINET.sill / 2, BOOTH.frontZ + CABINET.proud + 0.001]}>
        <planeGeometry args={[0.24, 0.03]} />
        <meshStandardMaterial map={plate} metalness={0.75} roughness={0.38} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>

      {/* the cabinet's soft shadow on the page */}
      <group position={[0, CABINET_FACE.bottom - 0.001, BOOTH.frontZ - (BOOTH.frontZ - BOOTH.backZ) * 0.25]}>
        <ContactBlob w={CABINET_FACE.w} d={(BOOTH.frontZ - BOOTH.backZ) * 0.85} spread={1.12} />
      </group>

      <Tray />
    </group>
  );
}

/**
 * Desktop floor reflection: a satin, blurred, low-mix mirror of the booth on the flat part of the
 * floor (inside the coves), 1mm above it. Low resolution and heavily blurred: a soft sheen,
 * never a mirror.
 */
function FloorReflection() {
  const depth = BOOTH.frontZ - BOOTH.backZ;
  const rough = useMemo(() => {
    const r = roughnessNoise().clone();
    r.repeat.set(4, 3);
    r.needsUpdate = true;
    return r;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, (BOOTH.backZ + BOOTH.frontZ) / 2 - 0.02]} receiveShadow>
      <planeGeometry args={[BOOTH.width - 2 * COVE, depth - 2 * COVE - 0.04]} />
      <MeshReflectorMaterial
        resolution={384}
        blur={[420, 140]}
        mixBlur={1}
        mixStrength={0.55}
        mixContrast={1}
        mirror={0.25}
        depthScale={0.6}
        minDepthThreshold={0.3}
        maxDepthThreshold={1.1}
        color={FLOOR_GREY}
        roughness={0.55}
        roughnessMap={rough}
        metalness={0}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

/** The proofing tray: a chamfered plate on a short pedestal, with a shadow; only present while a sample is on it. */
function Tray() {
  const group = useRef<Group>(null);
  const mats = useRef<MeshStandardMaterial[]>([]);
  const level = useRef(0);
  useLayoutEffect(() => {
    const list: MeshStandardMaterial[] = [];
    group.current?.traverse((o) => {
      const m = (o as Mesh).material;
      if (m && (m as MeshStandardMaterial).isMeshStandardMaterial) list.push(m as MeshStandardMaterial);
    });
    mats.current = list;
  }, []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const goal = useBooth.getState().activeSlug ? 1 : 0;
    level.current += (goal - level.current) * (1 - Math.exp(-dt * 6));
    if (Math.abs(goal - level.current) < 0.002) level.current = goal;
    else state.invalidate();
    for (const m of mats.current) {
      m.opacity = level.current;
      m.transparent = level.current < 1;
    }
    g.visible = level.current > 0.01;
  });
  return (
    <group ref={group} position={[0, 0, TRAY.z]}>
      <ContactBlob w={0.12} d={0.12} spread={1.6} />
      <mesh position={[0, TRAY.stand / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.035, 0.05, TRAY.stand, 48]} />
        <meshStandardMaterial color="#6E6E6C" roughness={0.45} metalness={0.5} transparent opacity={0} />
      </mesh>
      <RoundedBox args={[TRAY.w, TRAY.h, TRAY.d]} radius={0.003} smoothness={2} position={[0, TRAY.stand + TRAY.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8F8F8D" roughness={0.5} metalness={0.2} transparent opacity={0} />
      </RoundedBox>
    </group>
  );
}

/** Staging helpers for slots: the base mesh for a lineup sample (shell geometry, uv1 for the AO). */
export function baseFor(lineup: string[], slug: string) {
  return booth(lineup).find((p) => p.role === 'base' && p.slug === slug) ?? null;
}

export { STAGING };
