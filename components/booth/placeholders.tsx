'use client';

import { RoundedBox } from '@react-three/drei';
import type { ReactNode } from 'react';

/**
 * Phase 0 stand-ins at real-world scale (metres, origin at base centre).
 * Replaced one by one with Blender GLBs in Phase 4.
 */
type Placeholder = { width: number; render: () => ReactNode };

const paper = '#EDEBE4';
const ink = '#1A1A1A';
const screen = '#0E0F12';
const metal = '#9B9B98';

function Mat({ color, rough = 0.7, metalness = 0 }: { color: string; rough?: number; metalness?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metalness} />;
}

function Laptop() {
  const w = 0.3, d = 0.21, t = 0.015;
  return (
    <group>
      <mesh position={[0, t / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <Mat color={metal} rough={0.4} metalness={0.6} />
      </mesh>
      <group position={[0, t, -d / 2]} rotation={[-0.26, 0, 0]}>
        <mesh position={[0, d / 2, 0]} castShadow>
          <boxGeometry args={[w, d, 0.008]} />
          <Mat color={metal} rough={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, d / 2, 0.0045]}>
          <planeGeometry args={[w * 0.92, d * 0.88]} />
          <Mat color={screen} rough={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function LeaningDevice({ w, h }: { w: number; h: number }) {
  return (
    <group>
      <mesh position={[0, 0.01, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.6, 0.02, 0.05]} />
        <Mat color={ink} />
      </mesh>
      <group position={[0, 0.005, 0]} rotation={[-0.22, 0, 0]}>
        <RoundedBox args={[w, h, 0.008]} radius={0.003} position={[0, h / 2, 0]} castShadow>
          <Mat color={ink} rough={0.3} />
        </RoundedBox>
        <mesh position={[0, h / 2, 0.0045]}>
          <planeGeometry args={[w * 0.92, h * 0.94]} />
          <Mat color={screen} rough={0.2} />
        </mesh>
      </group>
    </group>
  );
}

export const PLACEHOLDERS: Record<string, Placeholder> = {
  'too-yumm': {
    width: 0.16,
    render: () => (
      <RoundedBox args={[0.16, 0.24, 0.07]} radius={0.01} position={[0, 0.12, 0]} castShadow receiveShadow>
        <Mat color="#E9C46A" rough={0.35} />
      </RoundedBox>
    ),
  },
  sook: {
    width: 0.24,
    render: () => (
      <group>
        {[-0.08, 0, 0.08].map((x, i) => (
          <mesh key={x} position={[x, 0.065, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.07, 0.13, 0.07]} />
            <Mat color={['#7A9E7E', '#C97B63', '#D8C8A8'][i]} />
          </mesh>
        ))}
      </group>
    ),
  },
  shunya: {
    width: 0.2,
    render: () => (
      <group>
        <mesh position={[-0.05, 0.045, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.09, 48]} />
          <Mat color={paper} rough={0.15} />
        </mesh>
        <mesh position={[0.06, 0.015, 0.01]} castShadow receiveShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.03, 48]} />
          <Mat color={metal} rough={0.35} metalness={0.8} />
        </mesh>
      </group>
    ),
  },
  'jsw-sports': {
    width: 0.4,
    render: () => (
      <group>
        {[-1, 1].map((s) => (
          <group key={s} rotation={[0, -s * 0.45, 0]}>
            <mesh position={[s * 0.12, 0.15, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.24, 0.3, 0.012]} />
              <Mat color={s < 0 ? ink : paper} />
            </mesh>
          </group>
        ))}
      </group>
    ),
  },
  'bengal-t20': {
    width: 0.22,
    render: () => (
      <group>
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.04, 0.15]} />
          <Mat color="#1F3A93" />
        </mesh>
        <mesh position={[0.01, 0.045, 0.01]} castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.01, 0.12]} />
          <Mat color="#F2B705" />
        </mesh>
        <mesh position={[-0.02, 0.0525, 0.02]} rotation={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.005, 0.06]} />
          <Mat color={paper} />
        </mesh>
      </group>
    ),
  },
  mitooshi: { width: 0.3, render: () => <Laptop /> },
  'indo-thai': { width: 0.3, render: () => <Laptop /> },
  'house-of-hex': { width: 0.1, render: () => <LeaningDevice w={0.072} h={0.15} /> },
  sonde: { width: 0.25, render: () => <LeaningDevice w={0.25} h={0.18} /> },
};
