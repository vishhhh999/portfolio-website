'use client';

import { RoundedBox, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  MeshBasicMaterial,
  SRGBColorSpace,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { useBooth } from '@/lib/store';
import { BOOTH, CABINET, CABINET_FACE, DIFFUSER, LIP, PLINTH_CHAMFER, PLINTH_GREY, PROPS, TRAY } from './staging';
import { applyUV } from './uvMaterial';

RectAreaLightUniformsLib.init();

/** Munsell N7-ish booth grey. Floor a step darker, ceiling a step lighter, so planes separate. */
export const BOOTH_GREY = '#A8A8A6';
const FLOOR_GREY = '#9C9C9A';
const CEILING_GREY = '#B3B3B1';
/** The housing: dark charcoal, so the lit opening reads as the booth's face. */
const HOUSING = '#2F2F2D';
const LIP_GREY = '#9E9E9C';

/**
 * Ceiling: lit only by bounce (no lamp faces it), so the rig sets its level and
 * tint directly per lamp. Avoids the area light's negative term behind its plane.
 */
export const ceilingMaterial = new MeshBasicMaterial({ color: CEILING_GREY, toneMapped: true });

/** Diffuser face: its colour/level is driven by the lamp rig (it glows under D50/TL84/UV). */
export const diffuserMaterial = new MeshBasicMaterial({ color: '#F4F3EE', toneMapped: true });

// ── soft contact shadow (blob) ─────────────────────────────────────────────
function blobTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // rounded-rect distance falloff: dense under the footprint, soft at the edge
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
/** One shared material for every contact shadow; the rig sets its opacity per lamp. */
export function getBlobMaterial() {
  if (!blobMat) blobMat = new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
  return blobMat;
}

/** Grounding shadow under a footprint (w × d), lying on the surface at local y = 0. */
export function ContactBlob({ w, d, spread = 1.35 }: { w: number; d: number; spread?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015, 0]} material={getBlobMaterial()} renderOrder={1}>
      <planeGeometry args={[w * spread, d * spread]} />
    </mesh>
  );
}

// ── maker's plate ──────────────────────────────────────────────────────────
function plateTexture() {
  const W = 1024, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#d9d9d6');
  grad.addColorStop(1, '#bdbdba');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2) {
    g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.05})`;
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

function Surface(props: { position: [number, number, number]; rotation: [number, number, number]; size: [number, number]; color: string; shadows?: boolean }) {
  return (
    <mesh position={props.position} rotation={props.rotation} receiveShadow={props.shadows ?? false}>
      <planeGeometry args={props.size} />
      <meshStandardMaterial color={props.color} roughness={0.95} />
    </mesh>
  );
}

/**
 * The booth itself: an open-fronted box (floor, back wall, side walls and
 * ceiling meeting in clean corners), the glowing ceiling diffuser, the cabinet
 * around the opening, and a thin front lip with the maker's plate.
 */
export function BoothRoom() {
  const { width: w, height: h, backZ, frontZ } = BOOTH;
  const depth = frontZ - backZ;
  const cz = (backZ + frontZ) / 2;
  const plate = useMemo(plateTexture, []);
  return (
    <group>
      {/* interior */}
      <Surface position={[0, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} size={[w, depth]} color={FLOOR_GREY} shadows />
      <Surface position={[0, h / 2, backZ]} rotation={[0, 0, 0]} size={[w, h]} color={BOOTH_GREY} />
      <Surface position={[-w / 2, h / 2, cz]} rotation={[0, Math.PI / 2, 0]} size={[depth, h]} color={BOOTH_GREY} />
      <Surface position={[w / 2, h / 2, cz]} rotation={[0, -Math.PI / 2, 0]} size={[depth, h]} color={BOOTH_GREY} />
      <mesh position={[0, h, cz]} rotation={[Math.PI / 2, 0, 0]} material={ceilingMaterial}>
        <planeGeometry args={[w, depth]} />
      </mesh>

      {/* diffuser: the lamp's face, recessed a hair below the ceiling */}
      <mesh position={[0, h - 0.003, DIFFUSER.z]} rotation={[Math.PI / 2, 0, 0]} material={diffuserMaterial}>
        <planeGeometry args={[DIFFUSER.w, DIFFUSER.d]} />
      </mesh>
      {/* diffuser frame */}
      {[
        [0, DIFFUSER.z - DIFFUSER.d / 2 - 0.006, DIFFUSER.w + 0.024, 0.012],
        [0, DIFFUSER.z + DIFFUSER.d / 2 + 0.006, DIFFUSER.w + 0.024, 0.012],
      ].map(([x, z, fw, fd], i) => (
        <mesh key={i} position={[x, h - 0.006, z]}>
          <boxGeometry args={[fw, 0.012, fd]} />
          <meshStandardMaterial color="#8a8a88" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}

      {/* cabinet housing: shell around the box (offset 2mm so it never z-fights the interior) */}
      <group>
        <mesh position={[0, h + CABINET.header / 2 + 0.002, cz]}>
          <boxGeometry args={[CABINET_FACE.w, CABINET.header, depth]} />
          <meshStandardMaterial color={HOUSING} roughness={0.62} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (w / 2 + CABINET.post / 2 + 0.002), (CABINET_FACE.bottom + h + CABINET.header) / 2, cz]}>
            <boxGeometry args={[CABINET.post, CABINET_FACE.h, depth]} />
            <meshStandardMaterial color={HOUSING} roughness={0.62} />
          </mesh>
        ))}
        <mesh position={[0, CABINET_FACE.bottom / 2 - 0.002, cz]}>
          <boxGeometry args={[CABINET_FACE.w, -CABINET_FACE.bottom, depth]} />
          <meshStandardMaterial color={HOUSING} roughness={0.62} />
        </mesh>
      </group>

      {/* front face of the housing: a dark frame standing proud of the box, the iconic booth silhouette */}
      <group position={[0, 0, frontZ + CABINET.proud / 2]}>
        <RoundedBox args={[CABINET_FACE.w, CABINET.header, CABINET.proud]} radius={0.006} smoothness={2} position={[0, h + CABINET.header / 2, 0]}>
          <meshStandardMaterial color={HOUSING} roughness={0.55} />
        </RoundedBox>
        {[-1, 1].map((s) => (
          <RoundedBox key={s} args={[CABINET.post, CABINET_FACE.h, CABINET.proud]} radius={0.006} smoothness={2} position={[s * (w / 2 + CABINET.post / 2), (CABINET_FACE.bottom + h + CABINET.header) / 2, 0]}>
            <meshStandardMaterial color={HOUSING} roughness={0.55} />
          </RoundedBox>
        ))}
        <RoundedBox args={[CABINET_FACE.w, -CABINET_FACE.bottom, CABINET.proud]} radius={0.006} smoothness={2} position={[0, CABINET_FACE.bottom / 2, 0]}>
          <meshStandardMaterial color={HOUSING} roughness={0.55} />
        </RoundedBox>
        {/* maker's plate on the sill */}
        <mesh position={[0.5, -CABINET.sill / 2, CABINET.proud / 2 + 0.0006]}>
          <planeGeometry args={[0.24, 0.03]} />
          <meshStandardMaterial map={plate} metalness={0.75} roughness={0.38} />
        </mesh>
      </group>

      {/* soft shadow of the cabinet on the page */}
      <group position={[0, CABINET_FACE.bottom - 0.001, frontZ - depth * 0.25]}>
        <ContactBlob w={CABINET_FACE.w} d={depth * 0.8} spread={1.12} />
      </group>

      {/* inner lip on the booth floor at the opening */}
      <mesh position={[0, LIP.h / 2, frontZ - LIP.d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, LIP.h, LIP.d]} />
        <meshStandardMaterial color={LIP_GREY} roughness={0.7} />
      </mesh>

      <Tray />
    </group>
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
        <cylinderGeometry args={[0.035, 0.05, TRAY.stand, 32]} />
        <meshStandardMaterial color="#6E6E6C" roughness={0.5} metalness={0.3} transparent opacity={0} />
      </mesh>
      <RoundedBox args={[TRAY.w, TRAY.h, TRAY.d]} radius={0.003} smoothness={1} position={[0, TRAY.stand + TRAY.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8F8F8D" roughness={0.55} metalness={0.15} transparent opacity={0} />
      </RoundedBox>
    </group>
  );
}

// ── calibration props ──────────────────────────────────────────────────────
function glossSwatchTexture() {
  const W = 256, H = 360;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3f1ea';
  g.fillRect(0, 0, W, H);
  ['#e2007a', '#009ee0', '#ffed00', '#1e1e1e', '#e2231a'].forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(24, 24 + i * 62, W - 48, 50);
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Calibration props on a small ledge on the back wall: a mini 24-patch chart
 * (published sRGB values), the paper card carrying test fluorMask + uvInk
 * textures, and a glossy laminated swatch that shows each lamp's reflection.
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
  const gloss = useMemo(glossSwatchTexture, []);

  const cardMat = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    if (cardMat.current) applyUV(cardMat.current, { fluorMask: cardFluor, uvInk: cardInk });
  }, [cardFluor, cardInk]);

  // the tray shot looks up past the shelf: the props would sit under the masthead, so they step out
  const activeSlug = useBooth((s) => s.activeSlug);

  const { ledge, checker: ch, card, gloss: gl } = PROPS;
  const back = BOOTH.backZ;
  const top = ledge.y + ledge.h;
  return (
    <group visible={!activeSlug}>
      <mesh position={[ledge.x, ledge.y + ledge.h / 2, back + ledge.d / 2]} castShadow receiveShadow>
        <boxGeometry args={[ledge.w, ledge.h, ledge.d]} />
        <meshStandardMaterial color={PLINTH_GREY} roughness={0.85} />
      </mesh>
      <group position={[ch.x, top, back + 0.032]} rotation={[-ch.lean, ch.yaw, 0]}>
        <mesh position={[0, ch.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[ch.w, ch.h, 0.003]} />
          <meshStandardMaterial attach="material-0" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-1" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-2" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-3" color="#151515" roughness={0.8} />
          <meshStandardMaterial attach="material-4" map={checker} roughness={0.8} />
          <meshStandardMaterial attach="material-5" color="#151515" roughness={0.8} />
        </mesh>
      </group>
      <group position={[card.x, top, back + 0.034]} rotation={[-card.lean, card.yaw, 0]}>
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
      <group position={[gl.x, top, back + 0.04]} rotation={[-gl.lean, gl.yaw, 0]}>
        <mesh position={[0, gl.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[gl.w, gl.h, 0.0015]} />
          <meshPhysicalMaterial attach="material-0" color="#EEECE6" roughness={0.3} />
          <meshPhysicalMaterial attach="material-1" color="#EEECE6" roughness={0.3} />
          <meshPhysicalMaterial attach="material-2" color="#EEECE6" roughness={0.3} />
          <meshPhysicalMaterial attach="material-3" color="#EEECE6" roughness={0.3} />
          <meshPhysicalMaterial attach="material-4" map={gloss} roughness={0.18} clearcoat={1} clearcoatRoughness={0.02} />
          <meshPhysicalMaterial attach="material-5" color="#EEECE6" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
