'use client';

import { useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
  type Material,
  type RectAreaLight,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getWork } from '@/content/work';
import { isMobileTier } from '@/lib/perfTier';
import { screens, screenTexture } from './screens';
import { applyUV, type InkProjection } from './uvMaterial';

/**
 * Procedural booth objects for the projects without a Blender GLB (D3): real proportions, every
 * edge bevelled, physically based materials. Artwork comes only from the project's own stills
 * (public/booth/textures/<slug>/, see manifest.json) or its logo files; nothing is drawn.
 * Units: metres, origin at the base centre, front +Z. Every surface goes through the UV chunk.
 */

/** A project's first still (a video's poster), for screens without logo files. */
export const firstStill = (slug: string) => {
  const d = getWork(slug)?.deliverables[0];
  return d ? (d.type === 'video' ? d.poster ?? '' : d.src) : '';
};

/** A box with every edge rounded (radius r): proper 0–1 uvs per face, groups +x −x +y −y +z −z. */
const rbox = (w: number, h: number, d: number, r: number, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);

/** A flat plate with rounded corners in plan (thickness t, extruded along y), uvs 0–1 across its face. */
function roundedPlate(w: number, d: number, r: number, t: number): BufferGeometry {
  const s = new Shape();
  const x0 = -w / 2, y0 = -d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + d - r);
  s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
  s.lineTo(x0 + r, y0 + d);
  s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: Math.min(r * 0.4, t * 0.4), bevelSegments: 2, curveSegments: 6 });
  // shape coordinates → 0–1 across the face
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x0) / w, (pos.getY(i) - y0) / d);
  g.rotateX(-Math.PI / 2);
  return g;
}

type MatOpts = { ink?: InkProjection | null; fluor?: number };
function withUV<M extends Material>(m: M, o: MatOpts = {}) {
  applyUV(m, { fluor: o.fluor ?? 0, inkProj: o.ink ?? null });
  return m;
}

// ── materials ──────────────────────────────────────────────────────────────────────────────

/** Bead-blasted anodised aluminium (laptop, easel, phone stand). */
const aluminium = (o?: MatOpts, tint = '#C3C4C6') =>
  withUV(new MeshPhysicalMaterial({ color: tint, metalness: 1, roughness: 0.35, anisotropy: 0.5, anisotropyRotation: Math.PI / 2, envMapIntensity: 1 }), o);
/** Space-grey anodised (tablet and phone bodies). */
const graphite = (o?: MatOpts) => withUV(new MeshPhysicalMaterial({ color: '#4A4B4F', metalness: 1, roughness: 0.38, anisotropy: 0.3, envMapIntensity: 1 }), o);
/** Black glass bezel: the front of every device, around the screen. */
const blackGlass = () => withUV(new MeshPhysicalMaterial({ color: '#08090A', metalness: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1 }));

let keyboardNormal: Texture | null = null;
/**
 * Keyboard detail as a normal map (generated: keys are geometry, not artwork). A 15 × 5 grid of
 * keycaps with rounded tops and a space bar, the deck between them flat.
 */
function keyboardNormalMap() {
  if (keyboardNormal) return keyboardNormal;
  const W = 512, H = 192;
  const hgt = new Float32Array(W * H);
  const keyW = W / 15.6, keyH = H / 5.6, gap = 0.12;
  const rows = [15, 14, 13, 12, 6];
  rows.forEach((n, r) => {
    const y0 = (r + 0.3) * keyH;
    const widths = r === 4 ? [1.4, 1.2, 1.2, 6.4, 1.2, 1.2, 1.4, 1.6].slice(0, 8) : Array(n).fill(15 / n);
    let x = 0.3 * keyW;
    for (const kw of widths) {
      const x0 = x + gap * keyW * 0.5, x1 = x + kw * keyW - gap * keyW * 0.5;
      const y1 = y0 + keyH * (1 - gap);
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++)
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          if (xx < 0 || xx >= W || y < 0 || y >= H) continue;
          const ex = Math.min(xx - x0, x1 - xx) / 3, ey = Math.min(y - y0, y1 - y) / 3;
          hgt[y * W + xx] = Math.min(1, Math.min(ex, ey));
        }
      x += kw * keyW;
    }
  });
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const h = (xx: number, yy: number) => hgt[Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))];
      const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2, dy = (h(x, y + 1) - h(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      img.data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  keyboardNormal = new CanvasTexture(c);
  keyboardNormal.colorSpace = NoColorSpace;
  return keyboardNormal;
}

// ── screens ────────────────────────────────────────────────────────────────────────────────

/**
 * A device screen: the project's logo on its brand colour as an emissive layer, under a glass
 * layer (clearcoat) that reflects the booth when the room lamps are on. Sits 1.2mm in front of the
 * bezel so the two surfaces can never z-fight; the spill light faces out of the glass.
 */
export function Screen({ w, h, slug, ink }: { w: number; h: number; slug: string; ink?: Texture }) {
  const lightRef = useRef<RectAreaLight>(null);
  const { tex, material } = useMemo(() => {
    const tex = screenTexture(slug, w / h, firstStill(slug));
    const material = new MeshPhysicalMaterial({
      color: '#030304',
      roughness: 0.2,
      metalness: 0,
      emissive: '#ffffff',
      emissiveMap: tex.texture,
      emissiveIntensity: 0.5,
      // glass: a soft reflection of the booth, never a hot spot over the logo
      clearcoat: 0.4,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.7,
    });
    applyUV(material, { inkProj: ink ? { map: ink, box: [-w * 0.46, -h * 0.46, w * 0.46, h * 0.46] } : null });
    return { tex, material };
  }, [w, h, slug, ink]);

  const mobile = isMobileTier();
  useLayoutEffect(() => {
    if (!mobile && !lightRef.current) return;
    const entry = { material, light: mobile ? null : lightRef.current, colour: tex.colour };
    screens.add(entry);
    return () => void screens.delete(entry);
  }, [material, tex, mobile]);

  return (
    <group position={[0, 0, 0.0012]}>
      <mesh material={material}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* RectAreaLight emits along its local -Z; flip it to face out of the screen. */}
      {!mobile && <rectAreaLight ref={lightRef} width={w} height={h} intensity={0} rotation={[0, Math.PI, 0]} position={[0, 0, 0.001]} />}
    </group>
  );
}

// ── devices ────────────────────────────────────────────────────────────────────────────────

/** A 13-inch class laptop: aluminium unibody, keyboard well, trackpad, hinge, lid open ~105°. */
function Laptop({ inkTex, slug }: { inkTex: Texture; slug: string }) {
  const W = 0.304, D = 0.215, T = 0.0145, LT = 0.0062;
  const parts = useMemo(() => {
    const kbn = keyboardNormalMap();
    const deck = new MeshPhysicalMaterial({ color: '#1C1D1F', metalness: 0.2, roughness: 0.6, normalMap: kbn, normalScale: new Vector2(0.9, 0.9) });
    applyUV(deck, {});
    return {
      base: rbox(W, T, D, 0.0055, 4),
      lid: rbox(W, D - 0.006, LT, 0.0045, 4),
      bezel: rbox(W - 0.006, D - 0.014, 0.001, 0.0035, 2),
      hinge: rbox(W - 0.06, 0.0085, 0.0085, 0.0042, 3),
      well: rbox(W - 0.03, 0.0012, 0.093, 0.004, 2),
      pad: rbox(0.115, 0.0008, 0.072, 0.0045, 2),
      alu: aluminium(),
      dark: graphite(),
      deck,
      glass: blackGlass(),
      padMat: withUV(new MeshPhysicalMaterial({ color: '#B9BABC', metalness: 0.7, roughness: 0.28, clearcoat: 0.6 })),
    };
  }, []);
  const tilt = -0.27; // lid back from vertical
  return (
    <group>
      <mesh geometry={parts.base} material={parts.alu} position={[0, T / 2, 0]} castShadow receiveShadow />
      {/* keyboard well and trackpad, each standing proud of the deck by a fraction of a millimetre */}
      <mesh geometry={parts.well} material={parts.deck} position={[0, T + 0.0003, -0.032]} receiveShadow />
      <mesh geometry={parts.pad} material={parts.padMat} position={[0, T + 0.0002, 0.058]} receiveShadow />
      <mesh geometry={parts.hinge} material={parts.dark} position={[0, T + 0.0018, -D / 2 + 0.006]} castShadow />
      <group position={[0, T + 0.002, -D / 2 + 0.006]} rotation={[tilt, 0, 0]}>
        <mesh geometry={parts.lid} material={parts.alu} position={[0, (D - 0.006) / 2, -LT / 2]} castShadow receiveShadow />
        {/* black glass front, 0.5mm proud of the lid; the screen 1.2mm proud of the glass */}
        <mesh geometry={parts.bezel} material={parts.glass} position={[0, (D - 0.006) / 2, 0.0005]} />
        <group position={[0, (D - 0.006) / 2 + 0.003, 0.0011]}>
          <Screen w={W - 0.026} h={D - 0.042} slug={slug} ink={inkTex} />
        </group>
      </group>
    </group>
  );
}

/** A tablet, landscape, leaning back on an aluminium easel (a back leg and a front ledge). */
function TabletOnEasel({ inkTex }: { inkTex: Texture }) {
  const w = 0.25, h = 0.176, t = 0.0064;
  const lean = -0.32;
  const parts = useMemo(
    () => ({
      body: rbox(w, h, t, 0.009, 4),
      glass: rbox(w - 0.002, h - 0.002, 0.0008, 0.0085, 3),
      ledge: rbox(0.2, 0.012, 0.02, 0.003, 3),
      lip: rbox(0.2, 0.012, 0.004, 0.0018, 2),
      leg: rbox(0.016, 0.15, 0.006, 0.0028, 3),
      foot: rbox(0.06, 0.004, 0.09, 0.002, 2),
      alu: aluminium(),
      dark: graphite(),
      glassMat: blackGlass(),
    }),
    [],
  );
  // the tablet's bottom edge rests on the ledge, at y = 0.012; the leg meets its back
  const ly = 0.012, lz = 0.016;
  return (
    <group>
      <mesh geometry={parts.foot} material={parts.alu} position={[0, 0.002, -0.02]} castShadow receiveShadow />
      <mesh geometry={parts.ledge} material={parts.alu} position={[0, 0.006, lz]} castShadow receiveShadow />
      <mesh geometry={parts.lip} material={parts.alu} position={[0, 0.0185, lz + 0.008]} castShadow />
      {/* the back leg: from the foot up behind the tablet, 4mm clear of its back face */}
      <mesh geometry={parts.leg} material={parts.alu} position={[0, 0.074, -0.058]} rotation={[0.36, 0, 0]} castShadow />
      <group position={[0, ly, lz - 0.002]} rotation={[lean, 0, 0]}>
        <mesh geometry={parts.body} material={parts.dark} position={[0, h / 2, -t / 2]} castShadow receiveShadow />
        <mesh geometry={parts.glass} material={parts.glassMat} position={[0, h / 2, 0.0004]} />
        <group position={[0, h / 2, 0.0008]}>
          <Screen w={w - 0.022} h={h - 0.022} slug="sonde" ink={inkTex} />
        </group>
      </group>
    </group>
  );
}

/** A phone, portrait, in an aluminium cradle stand. */
function PhoneInStand({ inkTex }: { inkTex: Texture }) {
  const w = 0.0716, h = 0.1476, t = 0.0078;
  const lean = -0.27;
  const parts = useMemo(() => {
    // the stand's side profile: a base plate rising into a back support, every edge rounded
    const s = new Shape();
    s.moveTo(-0.045, 0);
    s.lineTo(0.035, 0);
    s.lineTo(0.035, 0.006);
    s.lineTo(-0.012, 0.006);
    s.lineTo(-0.03, 0.075);
    s.lineTo(-0.038, 0.075);
    s.lineTo(-0.045, 0.006);
    s.closePath();
    const profile = new ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 2 });
    profile.rotateY(-Math.PI / 2); // profile x (front → back) onto −z: the support rises at the back
    profile.translate(0.035, 0, 0);
    return { stand: profile, body: rbox(w, h, t, 0.0095, 4), glass: rbox(w - 0.0016, h - 0.0016, 0.0007, 0.009, 3), lip: rbox(0.07, 0.008, 0.006, 0.002, 2), alu: aluminium(undefined, '#B4B5B8'), dark: graphite(), glassMat: blackGlass() };
  }, []);
  return (
    <group>
      <mesh geometry={parts.stand} material={parts.alu} castShadow receiveShadow />
      <mesh geometry={parts.lip} material={parts.alu} position={[0, 0.01, 0.028]} castShadow />
      <group position={[0, 0.007, 0.022]} rotation={[lean, 0, 0]}>
        <mesh geometry={parts.body} material={parts.dark} position={[0, h / 2, -t / 2]} castShadow receiveShadow />
        <mesh geometry={parts.glass} material={parts.glassMat} position={[0, h / 2, 0.0004]} />
        <group position={[0, h / 2, 0.0008]}>
          <Screen w={w - 0.007} h={h - 0.012} slug="house-of-hex" ink={inkTex} />
        </group>
      </group>
    </group>
  );
}

// ── Bengal T20 League: flag, ticket, jersey swatches ───────────────────────────────────────

const BENGAL = '/booth/textures/bengal-t20';

/** Fabric: printed polyester with a soft sheen. */
function fabric(map: Texture, o?: MatOpts) {
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  return withUV(new MeshPhysicalMaterial({ map, roughness: 0.82, sheen: 1, sheenRoughness: 0.45, sheenColor: new Color('#ffffff'), envMapIntensity: 0.6 }), o);
}

function BengalStack({ inkTex }: { inkTex: Texture }) {
  const [flag, ticket, folk, tiger, rays] = useTexture([`${BENGAL}/flag.webp`, `${BENGAL}/ticket.webp`, `${BENGAL}/swatch-folk.webp`, `${BENGAL}/swatch-tiger.webp`, `${BENGAL}/swatch-rays.webp`]);
  const parts = useMemo(() => {
    for (const t of [flag, ticket, folk, tiger, rays]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
      t.wrapS = t.wrapT = RepeatWrapping;
    }
    const ink: InkProjection = { map: inkTex, box: [-0.11, 0, 0.11, 0.07] };
    // folded flag: soft, thick, rounded folds; the print on top, the same cloth round the sides
    const flagMat = fabric(flag.clone(), { ink });
    const sideMat = fabric(flag.clone());
    sideMat.map!.repeat.set(0.25, 0.25);
    const card = withUV(new MeshPhysicalMaterial({ map: ticket, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }), { ink, fluor: 0.4 });
    const cardEdge = withUV(new MeshPhysicalMaterial({ color: '#E9E6DE', roughness: 0.7 }), { fluor: 1 });
    return {
      flag: rbox(0.2, 0.034, 0.13, 0.011, 5),
      flagMats: [sideMat, sideMat, flagMat, sideMat, sideMat, sideMat],
      swatch: rbox(0.088, 0.0036, 0.066, 0.0017, 2),
      swatchMats: [folk, tiger, rays].map((m) => {
        const top = fabric(m);
        const edge = fabric(m.clone());
        return [edge, edge, top, edge, edge, edge];
      }),
      ticket: roundedPlate(0.14, 0.036, 0.004, 0.0006),
      ticketMats: [card, cardEdge],
    };
  }, [flag, ticket, folk, tiger, rays, inkTex]);
  return (
    <group>
      <mesh geometry={parts.flag} material={parts.flagMats} position={[-0.005, 0.017, -0.01]} castShadow receiveShadow />
      {/* jersey swatches, fanned on the flag, each lying on the one below */}
      {parts.swatchMats.map((m, i) => (
        <mesh key={i} geometry={parts.swatch} material={m} position={[-0.04 + i * 0.016, 0.0358 + i * 0.0037, -0.012 + i * 0.004]} rotation={[0, 0.28 - i * 0.2, 0]} castShadow receiveShadow />
      ))}
      {/* the match ticket, propped against the flag's front */}
      <group position={[0.02, 0.0185, 0.068]} rotation={[1.32, 0, 0]}>
        <mesh geometry={parts.ticket} material={parts.ticketMats} castShadow receiveShadow />
      </group>
    </group>
  );
}

type Procedural = (inkTex: Texture) => ReactNode;

/** Projects without a GLB get these; projects with one render nothing here while it loads. */
export const PLACEHOLDERS: Record<string, Procedural> = {
  mitooshi: (inkTex) => <Laptop inkTex={inkTex} slug="mitooshi" />,
  'indo-thai': (inkTex) => <Laptop inkTex={inkTex} slug="indo-thai" />,
  sonde: (inkTex) => <TabletOnEasel inkTex={inkTex} />,
  'house-of-hex': (inkTex) => <PhoneInStand inkTex={inkTex} />,
  'bengal-t20': (inkTex) => <BengalStack inkTex={inkTex} />,
};
