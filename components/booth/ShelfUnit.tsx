'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, CanvasTexture, MeshStandardMaterial, SRGBColorSpace, Vector3, type Material, type Mesh } from 'three';
import { shelfLabelListeners, shelfLabelRects } from './focus';
import { lineup } from '@/content/work';
import { markDirty } from '@/lib/dirty';
import { BOOTH_GREY, ContactBlob, roughnessNoise, shellAO } from './BoothRoom';
import { wallRoughness } from './imperfections';
import { PLINTH_GREY } from './staging';
import { SHELF, type ShelfDef, type ShelfPart } from './shelf';
import { useLayoutKey } from './useLayout';

/** The label rail's face: brushed N6.5 with the name engraved in mono capitals (a dark cut over a light lip). */
function labelTexture(text: string, w: number, h: number, textH: number) {
  const W = 1024, H = Math.max(32, Math.round((W * h) / w));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#a9a8a4';
  g.fillRect(0, 0, W, H);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 700; i++) {
    const y = rnd() * H, l = 30 + rnd() * 220, x = rnd() * W - 30;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
    g.fillRect(x, y, l, 1);
  }
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() || 'monospace';
  let px = Math.round((textH / h) * H * 0.92);
  g.font = `500 ${px}px ${mono}`;
  const label = text.toUpperCase();
  // tracked a little, and never wider than the rail
  const track = px * 0.08;
  const width = () => g.measureText(label).width + track * (label.length - 1);
  while (width() > W * 0.9 && px > 8) g.font = `500 ${--px}px ${mono}`;
  g.textBaseline = 'middle';
  let x = (W - width()) / 2;
  for (const ch of label) {
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillText(ch, x, H / 2 + Math.max(1, px * 0.05));
    g.fillStyle = '#2a2a2c';
    g.fillText(ch, x, H / 2);
    x += g.measureText(ch).width + track;
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const TITLES: Record<string, string> = Object.fromEntries([...lineup.map((w) => [w.slug, w.title]), ['about', 'About']]);

/**
 * L3 (09B): the wall shelf, drawn from shelf.ts. Sides, crown, plinth and dividers in the booth's N8
 * wall paint, boards in the plinths' N8.5, the back panel N8; the baked AO (its own atlas) on all of
 * them. Under each sample, on its board's front edge, an engraved label rail with the project's name.
 */
export function ShelfUnit({ parts, def, mobile }: { parts: ShelfPart[]; def: ShelfDef; mobile: boolean }) {
  const key = useLayoutKey();
  const invalidate = useThree((s) => s.invalidate);
  const mats = useMemo(() => {
    const ao = shellAO(key);
    const rough = roughnessNoise();
    const paint = (repeat: [number, number]) => {
      const r = wallRoughness().clone();
      r.repeat.set(...repeat);
      r.needsUpdate = true;
      return r;
    };
    return {
      carcass: new MeshStandardMaterial({ color: BOOTH_GREY, roughness: 0.95, roughnessMap: paint([1, 2]), aoMap: ao, envMapIntensity: 0.35 }),
      back: new MeshStandardMaterial({ color: BOOTH_GREY, roughness: 0.98, roughnessMap: paint([1.2, 2]), aoMap: ao, envMapIntensity: 0.3 }),
      board: new MeshStandardMaterial({ color: PLINTH_GREY, roughness: 0.88, roughnessMap: rough, aoMap: ao, envMapIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }),
      kick: new MeshStandardMaterial({ color: '#A2A2A0', roughness: 0.7, roughnessMap: rough, aoMap: ao }),
      rail: new MeshStandardMaterial({ color: '#B4B4B2', roughness: 0.5, metalness: 0.35, envMapIntensity: 0.8 }),
    };
  }, [key]);

  // one face material per label: the engraving on the front (+z, group 4), the plain rail elsewhere
  const labels = useMemo(() => {
    const out = new Map<string, Material[]>();
    for (const p of parts) {
      if (p.role !== 'label' || !p.slug) continue;
      const face = mats.rail.clone();
      out.set(p.slug, [mats.rail, mats.rail, mats.rail, mats.rail, face, mats.rail]);
    }
    return out;
  }, [parts, mats]);
  useEffect(() => {
    let live = true;
    const made: CanvasTexture[] = [];
    void document.fonts.ready.then(() => {
      if (!live) return;
      for (const p of parts) {
        if (p.role !== 'label' || !p.slug) continue;
        const face = labels.get(p.slug)![4] as MeshStandardMaterial;
        p.geometry.computeBoundingBox();
        const bb = p.geometry.boundingBox!;
        const t = labelTexture(TITLES[p.slug] ?? p.slug, bb.max.x - bb.min.x, bb.max.y - bb.min.y, def.label.text);
        made.push(t);
        face.map = t;
        face.color.set('#ffffff');
        face.needsUpdate = true;
      }
      markDirty('shelf labels', undefined, 2);
      invalidate();
    });
    return () => {
      live = false;
      made.forEach((t) => t.dispose());
    };
  }, [parts, labels, def, invalidate]);

  // L3 (09B): where each label is on screen, every rendered frame (the floating lamp panel keeps clear of them)
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const labelMeshes = useRef(new Map<string, Mesh>());
  const tmp = useMemo(() => ({ box: new Box3(), v: new Vector3() }), []);
  useEffect(() => {
    window.__boothShelfLabels = () => Object.fromEntries(shelfLabelRects);
    return () => shelfLabelRects.clear();
  }, []);
  useFrame(() => {
    for (const [slug, m] of labelMeshes.current) {
      m.geometry.computeBoundingBox();
      tmp.box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const x of [tmp.box.min.x, tmp.box.max.x])
        for (const y of [tmp.box.min.y, tmp.box.max.y]) {
          tmp.v.set(x, y, tmp.box.max.z).project(camera);
          const px = ((tmp.v.x + 1) / 2) * size.width, py = ((1 - tmp.v.y) / 2) * size.height;
          l = Math.min(l, px); r = Math.max(r, px); t = Math.min(t, py); b = Math.max(b, py);
        }
      shelfLabelRects.set(slug, { left: l, top: t, right: r, bottom: b });
    }
    shelfLabelListeners.forEach((cb) => cb());
  });

  const matFor = (p: ShelfPart): Material | Material[] =>
    p.role === 'label' ? labels.get(p.slug!)! : p.role === 'back' ? mats.back : p.role === 'board' ? mats.board : p.name === 'kick' ? mats.kick : mats.carcass;

  return (
    <group>
      {/* the unit */}
      {parts
        .filter((p) => p.role !== 'base')
        .map((p) => (
          <mesh
            key={p.name}
            name={p.name}
            geometry={p.geometry}
            material={matFor(p)}
            position={p.position}
            userData={{ room: true, shelfLabel: p.role === 'label' ? p.slug : undefined }}
            ref={(m: Mesh | null) => {
              if (p.role !== 'label' || !p.slug) return;
              if (m) labelMeshes.current.set(p.slug, m);
              else labelMeshes.current.delete(p.slug);
            }}
            receiveShadow
            castShadow={p.role !== 'back' && p.role !== 'label'}
          />
        ))}
      {/* the unit's soft shadow on the page */}
      <group position={[0, 0.0005, SHELF.frontZ - (SHELF.depth + SHELF.back) / 2]}>
        <ContactBlob w={def.width} d={SHELF.depth + SHELF.back} spread={mobile ? 1.1 : 1.14} />
      </group>
    </group>
  );
}

declare global {
  interface Window {
    /** L7 (09B): the shelf's labels on screen, viewport CSS px (tools/check-shapes.mjs). */
    __boothShelfLabels?: () => Record<string, { left: number; top: number; right: number; bottom: number }>;
  }
}
