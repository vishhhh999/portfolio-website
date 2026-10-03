'use client';

import { RoundedBox, useTexture } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import { SRGBColorSpace, type MeshStandardMaterial } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { BOOTH, PLINTH_CHAMFER, PLINTH_GREY, PROPS, TRAY } from './staging';
import { applyUV } from './uvMaterial';

RectAreaLightUniformsLib.init();

/** Munsell N7-ish booth grey, calibrated by eye under the D50 rig. */
export const BOOTH_GREY = '#A8A8A6';

function Surface(props: { position: [number, number, number]; rotation: [number, number, number]; size: [number, number] }) {
  return (
    <mesh position={props.position} rotation={props.rotation} receiveShadow>
      <planeGeometry args={props.size} />
      <meshStandardMaterial color={BOOTH_GREY} roughness={0.95} />
    </mesh>
  );
}

export function BoothRoom() {
  const { width: w, depth: d, height: h, backZ } = BOOTH;
  const cz = backZ + d / 2;
  return (
    <group>
      <Surface position={[0, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} size={[w, d]} />
      <Surface position={[0, h / 2, backZ]} rotation={[0, 0, 0]} size={[w, h]} />
      <Surface position={[-w / 2, h / 2, cz]} rotation={[0, Math.PI / 2, 0]} size={[d, h]} />
      <Surface position={[w / 2, h / 2, cz]} rotation={[0, -Math.PI / 2, 0]} size={[d, h]} />
      <Surface position={[0, h, cz]} rotation={[Math.PI / 2, 0, 0]} size={[w, d]} />
      {/* proofing tray */}
      <mesh position={[0, 0.002, TRAY.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TRAY.w, TRAY.d]} />
        <meshStandardMaterial color="#ADADAB" roughness={0.88} />
      </mesh>
    </group>
  );
}

/**
 * Calibration props on a low shelf against the back wall: a 24-patch checker
 * (published sRGB values) and a paper card carrying test fluorMask + uvInk
 * textures. Detail for the finished site, and known colours to judge lamps by.
 */
export function CalibrationProps() {
  const [checker, cardBase, cardFluor, cardInk] = useTexture([
    '/textures/checker24.png',
    '/textures/card_base.png',
    '/textures/card_fluor.png',
    '/textures/card_uvink.png',
  ]);
  checker.colorSpace = SRGBColorSpace;
  cardBase.colorSpace = SRGBColorSpace;
  cardFluor.colorSpace = SRGBColorSpace;
  checker.anisotropy = cardBase.anisotropy = 8;

  const cardMat = useRef<MeshStandardMaterial>(null);
  const checkerMat = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    if (cardMat.current) applyUV(cardMat.current, { fluorMask: cardFluor, uvInk: cardInk });
    if (checkerMat.current) applyUV(checkerMat.current, { fluor: 0 });
  }, [cardFluor, cardInk]);

  const { shelf, checker: ch, card } = PROPS;
  const back = BOOTH.backZ;
  return (
    <group>
      <RoundedBox
        args={[shelf.w, shelf.h, shelf.d]}
        radius={PLINTH_CHAMFER}
        smoothness={1}
        position={[shelf.x, shelf.h / 2, back + shelf.d / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={PLINTH_GREY} roughness={0.92} />
      </RoundedBox>
      {/* checker, leaning back against the wall */}
      <group position={[ch.x, shelf.h, back + 0.065]} rotation={[-ch.lean, 0, 0]}>
        <mesh position={[0, ch.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[ch.w, ch.h, 0.004]} />
          <meshStandardMaterial attach="material-0" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-1" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-2" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-3" color="#151515" roughness={0.8} />
          <meshStandardMaterial ref={checkerMat} attach="material-4" map={checker} roughness={0.75} />
          <meshStandardMaterial attach="material-5" color="#151515" roughness={0.8} />
        </mesh>
      </group>
      {/* calibration card */}
      <group position={[card.x, shelf.h, back + 0.07]} rotation={[-card.lean, 0.12, 0]}>
        <mesh position={[0, card.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[card.w, card.h, 0.0012]} />
          <meshStandardMaterial attach="material-0" color="#EEECE6" roughness={0.9} />
          <meshStandardMaterial attach="material-1" color="#EEECE6" roughness={0.9} />
          <meshStandardMaterial attach="material-2" color="#EEECE6" roughness={0.9} />
          <meshStandardMaterial attach="material-3" color="#EEECE6" roughness={0.9} />
          <meshStandardMaterial ref={cardMat} attach="material-4" map={cardBase} roughness={0.88} />
          <meshStandardMaterial attach="material-5" color="#EEECE6" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
