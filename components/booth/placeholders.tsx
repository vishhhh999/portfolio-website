'use client';

import { RoundedBox } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Color, MeshBasicMaterial, PlaneGeometry, type MeshStandardMaterial, type RectAreaLight, type Texture } from 'three';
import { getScreenTexture, REGIONS, screens, type ScreenRegion } from './screens';
import { applyUV, createInkDecalMaterial } from './uvMaterial';

/**
 * Phase 0–3 stand-ins at real-world scale (metres, origin at base centre).
 * Every surface goes through the UV chunk; paper surfaces fluoresce; every
 * object carries its uvNotes as a hidden ink layer. Swapped for Blender GLBs
 * in Phase 4, which plug into the same fluorMask / uvInk slots.
 */
const paper = '#EDEBE4';
const ink = '#1A1A1A';
const alu = '#A7A7A4';
const blackGlass = '#0B0C0E';

export function BoothMat({
  color,
  roughness = 0.7,
  metalness = 0,
  fluor = 0,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
  fluor?: number;
}) {
  const ref = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    if (ref.current) applyUV(ref.current, { fluor });
  }, [fluor]);
  return <meshStandardMaterial ref={ref} color={color} roughness={roughness} metalness={metalness} />;
}

/** Hidden annotation layer: invisible until the UV lamp strikes. */
function InkDecal({ ink: tex, w, h, ...rest }: { ink: Texture; w: number; h: number } & ThreeElements['mesh']) {
  const mat = useMemo(() => createInkDecalMaterial(tex), [tex]);
  return (
    <mesh {...rest} material={mat} renderOrder={2}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/** Self-lit device screen: a region of the shared test video + a RectAreaLight that spills its colour. */
function Screen({ w, h, region }: { w: number; h: number; region: ScreenRegion }) {
  const lightRef = useRef<RectAreaLight>(null);
  const { geometry, material } = useMemo(() => {
    const geometry = new PlaneGeometry(w, h);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, region[0] + uv.getX(i) * (region[1] - region[0]));
    const material = new MeshBasicMaterial({ map: getScreenTexture(), toneMapped: true });
    return { geometry, material };
  }, [w, h, region]);

  useLayoutEffect(() => {
    if (!lightRef.current) return;
    const entry = { material, light: lightRef.current, region, colour: new Color(0.3, 0.3, 0.4) };
    screens.add(entry);
    return () => void screens.delete(entry);
  }, [material, region]);

  return (
    <group>
      <mesh geometry={geometry} material={material} />
      {/* RectAreaLight emits along its local -Z; flip it to face out of the screen. */}
      <rectAreaLight ref={lightRef} width={w} height={h} intensity={0} rotation={[0, Math.PI, 0]} position={[0, 0, 0.001]} />
    </group>
  );
}

function Laptop({ inkTex }: { inkTex: Texture }) {
  const w = 0.3, d = 0.21, t = 0.014;
  const open = -0.33; // lid ~109° from the deck
  return (
    <group position={[0, 0, 0.02]}>
      <RoundedBox args={[w, t, d]} radius={0.004} smoothness={2} position={[0, t / 2, 0]} castShadow receiveShadow>
        <BoothMat color={alu} roughness={0.35} metalness={0.7} />
      </RoundedBox>
      <group position={[0, t, -d / 2]} rotation={[open, 0, 0]}>
        <RoundedBox args={[w, d, 0.007]} radius={0.003} smoothness={2} position={[0, d / 2, 0]} castShadow receiveShadow>
          <BoothMat color={alu} roughness={0.35} metalness={0.7} />
        </RoundedBox>
        <group position={[0, d / 2 + 0.004, 0.0037]}>
          <Screen w={w * 0.92} h={d * 0.86} region={REGIONS.laptop} />
          <InkDecal ink={inkTex} w={w * 0.9} h={d * 0.84} position={[0, 0, 0.0008]} />
        </group>
      </group>
    </group>
  );
}

/** Tablet, landscape, on a low A-frame easel. */
function TabletOnEasel({ inkTex }: { inkTex: Texture }) {
  const w = 0.25, h = 0.175, tilt = -0.42;
  return (
    <group>
      {/* easel: front ledge + two rear legs */}
      <mesh position={[0, 0.008, 0.03]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.016, 0.022]} />
        <BoothMat color="#2B2A28" roughness={0.6} />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.05, -0.035]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.012, 0.12, 0.008]} />
          <BoothMat color="#2B2A28" roughness={0.6} />
        </mesh>
      ))}
      <group position={[0, 0.016, 0.03]} rotation={[tilt, 0, 0]}>
        <RoundedBox args={[w, h, 0.007]} radius={0.006} smoothness={3} position={[0, h / 2, -0.004]} castShadow receiveShadow>
          <BoothMat color="#2E2F33" roughness={0.3} metalness={0.4} />
        </RoundedBox>
        <group position={[0, h / 2, 0.0002]}>
          <Screen w={w * 0.92} h={h * 0.88} region={REGIONS.tablet} />
          <InkDecal ink={inkTex} w={w * 0.9} h={h * 0.86} position={[0, 0, 0.0008]} />
        </group>
      </group>
    </group>
  );
}

/** Phone, portrait, in a solid wedge stand. */
function PhoneInStand({ inkTex }: { inkTex: Texture }) {
  const w = 0.072, h = 0.15, tilt = -0.3;
  return (
    <group>
      <mesh position={[0, 0.015, -0.005]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.03, 0.07]} />
        <BoothMat color="#3A3936" roughness={0.45} metalness={0.2} />
      </mesh>
      <group position={[0, 0.022, 0.012]} rotation={[tilt, 0, 0]}>
        <RoundedBox args={[w, h, 0.008]} radius={0.007} smoothness={3} position={[0, h / 2, -0.004]} castShadow receiveShadow>
          <BoothMat color={blackGlass} roughness={0.2} metalness={0.3} />
        </RoundedBox>
        <group position={[0, h / 2, 0.0002]}>
          <Screen w={w * 0.9} h={h * 0.93} region={REGIONS.phone} />
          <InkDecal ink={inkTex} w={w * 0.88} h={h * 0.9} position={[0, 0, 0.0008]} />
        </group>
      </group>
    </group>
  );
}

type Placeholder = (inkTex: Texture) => ReactNode;

export const PLACEHOLDERS: Record<string, Placeholder> = {
  'too-yumm': (inkTex) => (
    <group>
      <RoundedBox args={[0.16, 0.24, 0.07]} radius={0.012} smoothness={3} position={[0, 0.12, 0]} castShadow receiveShadow>
        <BoothMat color="#E9C46A" roughness={0.32} />
      </RoundedBox>
      <InkDecal ink={inkTex} w={0.14} h={0.21} position={[0, 0.125, 0.0352]} />
    </group>
  ),
  'jsw-sports': (inkTex) => (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} rotation={[0, -s * 0.45, 0]}>
          <mesh position={[s * 0.12, 0.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.24, 0.3, 0.012]} />
            {s < 0 ? <BoothMat color={ink} roughness={0.28} /> : <BoothMat color={paper} roughness={0.85} fluor={1} />}
          </mesh>
          {s > 0 && <InkDecal ink={inkTex} w={0.22} h={0.27} position={[0.12, 0.15, 0.0065]} />}
        </group>
      ))}
    </group>
  ),
  mitooshi: (inkTex) => <Laptop inkTex={inkTex} />,
  'indo-thai': (inkTex) => <Laptop inkTex={inkTex} />,
  sonde: (inkTex) => <TabletOnEasel inkTex={inkTex} />,
  'house-of-hex': (inkTex) => <PhoneInStand inkTex={inkTex} />,
  'bengal-t20': (inkTex) => (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.04, 0.15]} />
        <BoothMat color="#1F3A93" roughness={0.9} />
      </mesh>
      <mesh position={[0.01, 0.045, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.01, 0.12]} />
        <BoothMat color="#F2B705" roughness={0.9} />
      </mesh>
      <mesh position={[-0.02, 0.0525, 0.02]} rotation={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.005, 0.06]} />
        <BoothMat color={paper} roughness={0.6} fluor={1} />
      </mesh>
      <InkDecal ink={inkTex} w={0.2} h={0.034} position={[0, 0.02, 0.0755]} />
    </group>
  ),
  sook: (inkTex) => (
    <group>
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={x} position={[x, 0.065, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.13, 0.07]} />
          <BoothMat color={['#7A9E7E', '#C97B63', '#D8C8A8'][i]} roughness={0.5} fluor={i === 2 ? 0.4 : 0} />
        </mesh>
      ))}
      <InkDecal ink={inkTex} w={0.23} h={0.12} position={[0, 0.065, 0.0355]} />
    </group>
  ),
  shunya: () => (
    <group>
      <mesh position={[-0.05, 0.045, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.09, 48]} />
        <BoothMat color={paper} roughness={0.15} fluor={0.6} />
      </mesh>
      <mesh position={[0.06, 0.015, 0.01]} castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 48]} />
        <BoothMat color={alu} roughness={0.35} metalness={0.8} />
      </mesh>
    </group>
  ),
};

/** Aspect of each object's ink layer (w / h of the face it is printed on). */
export const INK_ASPECT: Record<string, number> = {
  'too-yumm': 0.14 / 0.21,
  'jsw-sports': 0.22 / 0.27,
  mitooshi: 0.27 / 0.176,
  'indo-thai': 0.27 / 0.176,
  sonde: 0.225 / 0.15,
  'house-of-hex': 0.063 / 0.135,
  'bengal-t20': 0.2 / 0.034,
  sook: 0.23 / 0.12,
  shunya: 1,
};
