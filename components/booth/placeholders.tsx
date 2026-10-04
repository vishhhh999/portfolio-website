'use client';

import { useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  PlaneGeometry,
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
const blackGlass = () => withUV(new MeshPhysicalMaterial({ color: '#08090A', metalness: 0, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.12, envMapIntensity: 0.7 }));

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
      // the display under the glass is matte: the glass (clearcoat) carries the reflection
      roughness: 0.65,
      metalness: 0,
      emissive: '#ffffff',
      emissiveMap: tex.texture,
      emissiveIntensity: 0.5,
      // glass: a soft, small reflection of the booth, never a blob over the logo (F6): a smooth
      // coat (a highlight stays small and sharp instead of spreading) and little environment
      clearcoat: 0.35,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.22,
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

let knitNormal: Texture | null = null;
/**
 * Jersey knit as a normal map (generated: stitch geometry, not artwork): columns of interlocking
 * V-shaped loops, the way a single-jersey knit reads up close. Tiled across a swatch.
 */
function knitNormalMap() {
  if (knitNormal) return knitNormal;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  // height field: each stitch is two slanted ridges (a V), 16 columns × 20 rows per tile
  const cols = 16, rows = 20;
  const hgt = (x: number, y: number) => {
    const u = ((x / N) * cols) % 1, v = ((y / N) * rows) % 1;
    const side = u < 0.5 ? u * 2 : (1 - u) * 2; // 0 at the column edge, 1 at its centre
    const leg = Math.abs(side - (1 - v)); // a slanted leg of the V
    return Math.max(0, 1 - leg * 3.2) * (0.6 + 0.4 * Math.sin(v * Math.PI));
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = hgt((x + 1) % N, y) - hgt((x - 1 + N) % N, y);
      const dy = hgt(x, (y + 1) % N) - hgt(x, (y - 1 + N) % N);
      const nx = -dx * 1.4, ny = -dy * 1.4, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      img.data[i] = Math.round(((nx / l) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((ny / l) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((nz / l) * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  knitNormal = new CanvasTexture(c);
  knitNormal.colorSpace = NoColorSpace;
  knitNormal.wrapS = knitNormal.wrapT = RepeatWrapping;
  return knitNormal;
}

/** A soft cloth panel: a subdivided plane with low ripples (and an optional drape down one side). */
function clothPanel(w: number, d: number, ripple: number, drape = 0): BufferGeometry {
  const g = new PlaneGeometry(w, d, 40, 28);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = ripple * (Math.sin(x * 61 + z * 17) * 0.6 + Math.sin(z * 83 - x * 29) * 0.4);
    // drape: the last part of the swatch falls over the plinth's front edge
    if (drape > 0 && z > d / 2 - drape) y -= ((z - (d / 2 - drape)) / drape) ** 2 * drape * 0.5;
    p.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A folded flag (F2): three layers of cloth with the folds showing as rolled edges, alternating
 * front and back, the printed face on top with a low ripple. Fabric sheen, not a box.
 */
function foldedFlag(w: number, d: number, layers: number, t: number) {
  const top = clothPanel(w, d, 0.0007);
  top.translate(0, layers * t, 0);
  const under: BufferGeometry[] = [];
  for (let i = 0; i < layers; i++) {
    const inset = (layers - 1 - i) * 0.0015;
    const sheet = clothPanel(w - inset, d - inset * 2, 0.0004);
    sheet.translate(0, i * t + 0.0004, 0);
    under.push(sheet);
    // the fold joining this layer to the next: a half-roll along the front or the back edge
    const r = t / 2;
    const roll = new CylinderGeometry(r, r, w - inset - 0.004, 16, 1, true, 0, Math.PI);
    roll.rotateZ(Math.PI / 2);
    const front = i % 2 === 0;
    roll.rotateX(front ? -Math.PI / 2 : Math.PI / 2);
    roll.translate(0, i * t + r + 0.0004, front ? d / 2 - inset : -d / 2 + inset);
    under.push(roll);
  }
  return { top, under };
}

/**
 * Bengal T20 League (F2): the match-day set on its own plinth. A folded flag (printed face up,
 * folds and sheen), a match ticket (rounded corners, card thickness) leaning against it, and a
 * jersey swatch (knit) draped over the front edge. Textures are crops of the project's stills.
 */
function BengalStack({ inkTex }: { inkTex: Texture }) {
  const [flag, ticket, folk, tiger] = useTexture([`${BENGAL}/flag.webp`, `${BENGAL}/ticket.webp`, `${BENGAL}/swatch-folk.webp`, `${BENGAL}/swatch-tiger.webp`]);
  const parts = useMemo(() => {
    for (const t of [flag, ticket, folk, tiger]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
      t.wrapS = t.wrapT = RepeatWrapping;
    }
    const ink: InkProjection = { map: inkTex, box: [-0.13, 0, 0.13, 0.06] };
    const flagTop = fabric(flag.clone(), { ink });
    const cloth = fabric(flag.clone());
    cloth.map!.repeat.set(0.3, 0.3);
    cloth.side = DoubleSide;
    const knit = knitNormalMap();
    const jersey = (m: Texture) => {
      const mat = fabric(m.clone());
      mat.normalMap = knit;
      mat.normalScale = new Vector2(0.6, 0.6);
      mat.normalMap.repeat.set(3, 3);
      mat.side = DoubleSide;
      return mat;
    };
    const card = withUV(new MeshPhysicalMaterial({ map: ticket, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }), { ink, fluor: 0.4 });
    const cardEdge = withUV(new MeshPhysicalMaterial({ color: '#E9E6DE', roughness: 0.7 }), { fluor: 1 });
    return {
      flag: foldedFlag(0.15, 0.1, 3, 0.0062),
      flagTop,
      cloth,
      swatchA: clothPanel(0.085, 0.075, 0.0005, 0.03),
      swatchB: clothPanel(0.075, 0.065, 0.0004),
      jerseyA: jersey(tiger),
      jerseyB: jersey(folk),
      ticket: roundedPlate(0.15, 0.038, 0.0045, 0.0011),
      ticketMats: [card, cardEdge],
    };
  }, [flag, ticket, folk, tiger, inkTex]);
  return (
    <group>
      {/* the folded flag, back left */}
      <group position={[-0.05, 0, -0.025]} rotation={[0, 0.08, 0]}>
        <mesh geometry={parts.flag.top} material={parts.flagTop} castShadow receiveShadow />
        {parts.flag.under.map((g, i) => (
          <mesh key={i} geometry={g} material={parts.cloth} castShadow receiveShadow />
        ))}
      </group>
      {/* jersey swatches, right: one flat, one draped over the plinth's front edge */}
      <mesh geometry={parts.swatchB} material={parts.jerseyB} position={[0.085, 0.0012, -0.03]} rotation={[0, -0.22, 0]} castShadow receiveShadow />
      <mesh geometry={parts.swatchA} material={parts.jerseyA} position={[0.09, 0.0026, 0.03]} rotation={[0, 0.12, 0]} castShadow receiveShadow />
      {/* the match ticket, leaning against the flag's front fold */}
      <group position={[-0.045, 0.012, 0.047]} rotation={[1.18, 0, 0.04]}>
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
