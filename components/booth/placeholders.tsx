'use client';

import { RoundedBox } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Color,
  ExtrudeGeometry,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  type Material,
  type RectAreaLight,
  type Texture,
} from 'three';
import { getPosterTexture, REGIONS, screens, type ScreenRegion } from './screens';
import { applyUV, type InkProjection } from './uvMaterial';

/**
 * Phase 0–3 stand-ins at real-world scale (metres, origin at base centre).
 * Every surface goes through the UV chunk; paper fluoresces; each object
 * carries its uvNotes printed on its main face (projected, so the ink follows
 * curved pages and sits on screens). Swapped for Blender GLBs in Phase 4,
 * which use the uv-mapped fluorMask / uvInk slots instead.
 */
const paper = '#ECEAE3';
const alu = '#A9A9A6';
const cloth = '#2A2D33';

type MatProps = {
  color: string;
  roughness?: number;
  metalness?: number;
  fluor?: number;
  ink?: InkProjection | null;
  clearcoat?: number;
};

export function BoothMat({ color, roughness = 0.7, metalness = 0, fluor = 0, ink = null, clearcoat }: MatProps) {
  const ref = useRef<Material>(null);
  useLayoutEffect(() => {
    if (ref.current) applyUV(ref.current, { fluor, inkProj: ink });
  }, [fluor, ink]);
  if (clearcoat !== undefined)
    return (
      <meshPhysicalMaterial
        ref={ref as never}
        color={color}
        roughness={roughness}
        metalness={metalness}
        clearcoat={clearcoat}
        clearcoatRoughness={0.04}
      />
    );
  return <meshStandardMaterial ref={ref as never} color={color} roughness={roughness} metalness={metalness} />;
}

/** Self-lit device screen: a region of the screen still/video + a RectAreaLight that spills its colour. */
function Screen({ w, h, region, ink }: { w: number; h: number; region: ScreenRegion; ink?: Texture }) {
  const lightRef = useRef<RectAreaLight>(null);
  const { geometry, material } = useMemo(() => {
    const geometry = new PlaneGeometry(w, h);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, region[0] + uv.getX(i) * (region[1] - region[0]));
    const material = new MeshBasicMaterial({ map: getPosterTexture() });
    if (ink) applyUV(material, { inkProj: { map: ink, box: [-w * 0.46, -h * 0.46, w * 0.46, h * 0.46] } });
    return { geometry, material };
  }, [w, h, region, ink]);

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
  return (
    <group position={[0, 0, 0.02]}>
      <RoundedBox args={[w, t, d]} radius={0.004} smoothness={2} position={[0, t / 2, 0]} castShadow receiveShadow>
        <BoothMat color={alu} roughness={0.32} metalness={0.7} />
      </RoundedBox>
      <group position={[0, t, -d / 2]} rotation={[-0.33, 0, 0]}>
        <RoundedBox args={[w, d, 0.007]} radius={0.003} smoothness={2} position={[0, d / 2, 0]} castShadow receiveShadow>
          <BoothMat color={alu} roughness={0.32} metalness={0.7} />
        </RoundedBox>
        <group position={[0, d / 2 + 0.004, 0.0037]}>
          <Screen w={w * 0.92} h={d * 0.86} region={REGIONS.laptop} ink={inkTex} />
        </group>
      </group>
    </group>
  );
}

/** Tablet, landscape, on a low A-frame easel. */
function TabletOnEasel({ inkTex }: { inkTex: Texture }) {
  const w = 0.25, h = 0.175;
  return (
    <group>
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
      <group position={[0, 0.016, 0.03]} rotation={[-0.42, 0, 0]}>
        <RoundedBox args={[w, h, 0.007]} radius={0.006} smoothness={3} position={[0, h / 2, -0.004]} castShadow receiveShadow>
          <BoothMat color="#2E2F33" roughness={0.3} metalness={0.4} />
        </RoundedBox>
        <group position={[0, h / 2, 0.0002]}>
          <Screen w={w * 0.92} h={h * 0.88} region={REGIONS.tablet} ink={inkTex} />
        </group>
      </group>
    </group>
  );
}

/** Phone, portrait, in a solid wedge stand. */
function PhoneInStand({ inkTex }: { inkTex: Texture }) {
  const w = 0.072, h = 0.15;
  return (
    <group>
      <mesh position={[0, 0.015, -0.005]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 0.03, 0.075]} />
        <BoothMat color="#3A3936" roughness={0.45} metalness={0.2} />
      </mesh>
      <group position={[0, 0.022, 0.012]} rotation={[-0.3, 0, 0]}>
        <RoundedBox args={[w, h, 0.008]} radius={0.007} smoothness={3} position={[0, h / 2, -0.004]} castShadow receiveShadow>
          <BoothMat color="#0B0C0E" roughness={0.2} metalness={0.3} />
        </RoundedBox>
        <group position={[0, h / 2, 0.0002]}>
          <Screen w={w * 0.9} h={h * 0.93} region={REGIONS.phone} ink={inkTex} />
        </group>
      </group>
    </group>
  );
}

/** Page-block cross-section: flat underside, pages rising out of the gutter and easing down to the fore-edge. */
function pageBlockGeometry(pw: number, ph: number, side: 1 | -1) {
  const t = 0.012; // block thickness at the fore-edge
  const c = 0.011; // page bulge
  const z = (u: number) => t * (0.5 + 0.5 * u) + c * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.75);
  const s = new Shape();
  s.moveTo(side * 0.002, 0);
  s.lineTo(side * pw, 0);
  s.lineTo(side * pw, z(1));
  for (let i = 23; i >= 0; i--) {
    const u = i / 23;
    s.lineTo(side * (0.002 + u * (pw - 0.002)), z(u));
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: ph, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(Math.PI / 2); // extrude axis → -Y (page height), thickness → +Z (out of the page)
  g.translate(0, ph / 2, 0);
  g.computeVertexNormals();
  return g;
}

/** Coffee-table book, open on a low lectern, turned slightly: spine, cover boards, curved page blocks. */
function OpenBook({ inkTex }: { inkTex: Texture }) {
  const pw = 0.175, ph = 0.235, lean = 0.75;
  const geo = useMemo(() => ({ right: pageBlockGeometry(pw, ph, 1), left: pageBlockGeometry(pw, ph, -1) }), []);
  const ink = useMemo<InkProjection>(() => ({ map: inkTex, box: [0.014, -ph / 2 + 0.012, pw - 0.012, ph / 2 - 0.012] }), [inkTex]);
  return (
    <group rotation={[0, 0.12, 0]}>
      {/* lectern: back board + front ledge */}
      <group position={[0, (ph / 2) * Math.cos(lean) + 0.012, 0]} rotation={[-lean, 0, 0]}>
        <mesh position={[0, 0, -0.012]} castShadow receiveShadow>
          <boxGeometry args={[0.3, ph * 0.9, 0.008]} />
          <BoothMat color="#3B342D" roughness={0.65} />
        </mesh>
        {/* cover boards */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (pw / 2 + 0.002), 0, -0.0035]} castShadow receiveShadow>
            <boxGeometry args={[pw + 0.008, ph + 0.008, 0.003]} />
            <BoothMat color={cloth} roughness={0.85} />
          </mesh>
        ))}
        {/* spine */}
        <mesh position={[0, 0, -0.006]} rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.007, 0.007, ph + 0.008, 16, 1, false, Math.PI / 2, Math.PI]} />
          <BoothMat color={cloth} roughness={0.85} />
        </mesh>
        <mesh geometry={geo.left} castShadow receiveShadow>
          <BoothMat color={paper} roughness={0.9} fluor={1} />
        </mesh>
        <mesh geometry={geo.right} castShadow receiveShadow>
          <BoothMat color={paper} roughness={0.9} fluor={1} ink={ink} />
        </mesh>
      </group>
      <mesh position={[0, 0.006, (ph / 2) * Math.sin(lean) + 0.006]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.012, 0.014]} />
        <BoothMat color="#3B342D" roughness={0.65} />
      </mesh>
    </group>
  );
}

type Placeholder = (inkTex: Texture) => ReactNode;

export const PLACEHOLDERS: Record<string, Placeholder> = {
  'too-yumm': (inkTex) => (
    <RoundedBox args={[0.16, 0.24, 0.07]} radius={0.012} smoothness={3} position={[0, 0.12, 0]} castShadow receiveShadow>
      <BoothMat color="#E9C46A" roughness={0.3} ink={{ map: inkTex, box: [-0.068, -0.105, 0.068, 0.105] }} />
    </RoundedBox>
  ),
  'jsw-sports': (inkTex) => <OpenBook inkTex={inkTex} />,
  mitooshi: (inkTex) => <Laptop inkTex={inkTex} />,
  'indo-thai': (inkTex) => <Laptop inkTex={inkTex} />,
  sonde: (inkTex) => <TabletOnEasel inkTex={inkTex} />,
  'house-of-hex': (inkTex) => <PhoneInStand inkTex={inkTex} />,
  'bengal-t20': (inkTex) => (
    <group>
      {/* folded flag */}
      <mesh position={[0, 0.0225, -0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.045, 0.13]} />
        <BoothMat color="#1F3A93" roughness={0.92} />
      </mesh>
      {/* jersey swatches, fanned on top */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.05 + i * 0.012, 0.047 + i * 0.003, -0.02]} rotation={[0, 0.25 - i * 0.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.003, 0.07]} />
          <BoothMat color={['#F2B705', '#E5E5E2', '#C8102E'][i]} roughness={0.95} />
        </mesh>
      ))}
      {/* match ticket, propped against the flag */}
      <group position={[0.04, 0, 0.074]} rotation={[-0.2, -0.08, 0]}>
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <boxGeometry args={[0.13, 0.058, 0.002]} />
          <BoothMat color={paper} roughness={0.6} fluor={1} ink={{ map: inkTex, box: [-0.062, -0.026, 0.062, 0.026] }} />
        </mesh>
      </group>
    </group>
  ),
  sook: (inkTex) => (
    <group>
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={x} position={[x, 0.065, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.13, 0.07]} />
          <BoothMat
            color={['#7A9E7E', '#C97B63', '#D8C8A8'][i]}
            roughness={0.5}
            fluor={i === 2 ? 0.4 : 0}
            ink={i === 1 ? { map: inkTex, box: [-0.032, -0.06, 0.032, 0.06] } : null}
          />
        </mesh>
      ))}
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

/** Aspect (w / h) of the face each object's ink is printed on. */
export const INK_ASPECT: Record<string, number> = {
  'too-yumm': 0.136 / 0.21,
  'jsw-sports': 0.15 / 0.21,
  mitooshi: 1.45,
  'indo-thai': 1.45,
  sonde: 1.5,
  'house-of-hex': 0.47,
  'bengal-t20': 0.124 / 0.052,
  sook: 0.064 / 0.12,
  shunya: 1,
};
