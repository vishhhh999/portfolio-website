'use client';

import { ContactShadows } from '@react-three/drei';
import { useMemo } from 'react';
import { Color } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { kelvinToAdapted } from '@/lib/kelvin';
import { BOOTH, TRAY_Z } from './layout';

RectAreaLightUniformsLib.init();

/** Munsell N7-ish booth grey, calibrated by eye under the D50 rig. */
export const BOOTH_GREY = '#A8A8A6';

const PANEL = { width: 3.4, depth: 2.2 } as const;
const PANEL_Z = 0.5;

export function BoothRoom() {
  const { width: w, depth: d, height: h, backZ } = BOOTH;
  const cz = backZ + d / 2;
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={BOOTH_GREY} roughness={0.92} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, h / 2, backZ]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
      </mesh>
      {/* side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, h / 2, cz]} rotation={[0, -s * (Math.PI / 2), 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
        </mesh>
      ))}
      {/* ceiling */}
      <mesh position={[0, h, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
      </mesh>
      {/* lamp diffuser */}
      <mesh position={[0, h - 0.002, PANEL_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PANEL.width, PANEL.depth]} />
        <meshBasicMaterial color="#F4F3EE" toneMapped={false} />
      </mesh>
      <Tray />
    </group>
  );
}

/** The proofing tray: a low matte plate at the front of the booth. */
function Tray() {
  return (
    <mesh position={[0, 0.002, TRAY_Z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.9, 0.5]} />
      <meshStandardMaterial color="#B4B4B2" roughness={0.85} />
    </mesh>
  );
}

/**
 * D50 rig. A RectAreaLight sized to the diffuser does the real work: soft
 * top-down key, falloff down the back wall, broad speculars. A dim hemisphere
 * stands in for the bounce off N7 walls. Contact shadows ground every object,
 * which a RectAreaLight can't do on its own.
 */
export function D50Rig() {
  const colour = useMemo(() => new Color().setRGB(...kelvinToAdapted(5000)), []);
  const { height: h } = BOOTH;
  return (
    <>
      <rectAreaLight
        color={colour}
        intensity={4.2}
        width={PANEL.width}
        height={PANEL.depth}
        position={[0, h - 0.01, PANEL_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <hemisphereLight args={[colour, '#8E8E8C', 1.1]} />
      <ContactShadows
        position={[0, 0.003, 0.35]}
        scale={[BOOTH.width, 1.9]}
        resolution={1024}
        far={0.5}
        blur={2.2}
        opacity={0.55}
        color="#1a1a19"
      />
    </>
  );
}
