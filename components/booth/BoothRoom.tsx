'use client';

import { BOOTH } from './layout';

/** Munsell N7-ish booth grey. Calibrate by eye in Phase 1. */
export const BOOTH_GREY = '#A8A8A6';

export function BoothRoom() {
  const { width: w, depth: d, height: h, backZ } = BOOTH;
  const cz = backZ + d / 2;
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, h / 2, backZ]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
      </mesh>
      {/* side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, h / 2, cz]} rotation={[0, -s * (Math.PI / 2), 0]} receiveShadow>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
        </mesh>
      ))}
      {/* ceiling */}
      <mesh position={[0, h, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
      </mesh>
      {/* lamp diffuser panel (visual only; the RectAreaLight rig lands in Phase 1) */}
      <mesh position={[0, h - 0.002, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.8, d * 0.6]} />
        <meshBasicMaterial color="#F4F3EE" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Phase 0 placeholder rig: neutral fill + one shadow-casting key from the panel. */
export function PlaceholderLights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', BOOTH_GREY, 1.4]} />
      <directionalLight
        position={[0, 3.4, 2.4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
    </>
  );
}
