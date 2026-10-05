'use client';

import { Html, RoundedBox } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, Vector2 } from 'three';
import { useBooth } from '@/lib/store';
import { playEvent } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { applyUV } from './uvMaterial';
import { paperNormal, smudgeMap } from './imperfections';
import { BOOTH, CERTIFICATE, PROPS } from './staging';
import { setFocusRect } from './focus';

/**
 * The certificate's face, drawn from the real About page header only (B2): "CERTIFICATE OF
 * CALIBRATION", "VM BOOTH 01" and the name. Nothing else, nothing invented. Set in the page's own
 * fonts (Geist / Geist Mono, read from the document), on matte paper.
 */
function certificateFace() {
  const W = 1024, H = Math.round((1024 * CERTIFICATE.h) / CERTIFICATE.w);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const css = getComputedStyle(document.documentElement);
  const sans = css.getPropertyValue('--font-geist-sans').trim() || 'sans-serif';
  const mono = css.getPropertyValue('--font-geist-mono').trim() || 'monospace';
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, W, H);
  // the certificate's black header bar, as on the page
  const bar = Math.round(H * 0.13);
  g.fillStyle = '#111111';
  g.fillRect(0, 0, W, bar);
  g.fillStyle = '#f2f0ea';
  g.font = `400 ${Math.round(bar * 0.36)}px ${mono}`;
  g.textBaseline = 'middle';
  g.fillText('CERTIFICATE OF CALIBRATION', W * 0.05, bar / 2);
  g.textAlign = 'right';
  g.fillText('VM BOOTH 01', W * 0.95, bar / 2);
  g.textAlign = 'left';
  // the name, large, as the page's h1
  g.fillStyle = '#111111';
  g.font = `600 ${Math.round(H * 0.17)}px ${sans}`;
  g.textBaseline = 'alphabetic';
  g.fillText('Vishesh', W * 0.05, H * 0.5);
  g.fillText('Mahendru', W * 0.05, H * 0.69);
  // the certificate's border
  g.strokeStyle = '#111111';
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * The About object (B2): a small framed certificate standing on the shelf: black satin frame,
 * glass with a faint reflection, matte paper. Clicking it opens /about; hovering shows "About".
 */
export function Certificate() {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const activeSlug = useBooth((s) => s.activeSlug);
  const invalidate = useThree((s) => s.invalidate);
  const [face, setFace] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    // the page fonts first, so the face is set in Geist, not a fallback
    let live = true;
    void document.fonts.ready.then(() => {
      if (!live) return;
      setFace(certificateFace());
      invalidate();
    });
    return () => {
      live = false;
    };
  }, [invalidate]);
  const mats = useMemo(() => {
    const frame = new MeshPhysicalMaterial({ color: '#141415', metalness: 0.2, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    // J3: the glass carries faint fingerprints; the paper a fibre grain
    const glass = new MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.2, roughnessMap: smudgeMap(), transparent: true, opacity: 0.08, envMapIntensity: 0.6, depthWrite: false });
    const paper = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, normalMap: paperNormal(), normalScale: new Vector2(0.18, 0.18) });
    applyUV(frame, {});
    applyUV(paper, { fluor: 1 });
    return { frame, glass, paper };
  }, []);
  useEffect(() => {
    if (!face) return;
    mats.paper.map = face;
    mats.paper.needsUpdate = true;
    invalidate();
  }, [face, mats, invalidate]);
  useEffect(() => () => setFocusRect('about', null), []);

  const { w, h, d, x, lean } = CERTIFICATE;
  const top = PROPS.ledge.y + PROPS.ledge.h;
  const z = BOOTH.backZ + 0.035;
  const border = 0.012;
  return (
    <group
      position={[x, top, z]}
      rotation={[-lean, 0, 0]}
      visible={!activeSlug}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 6 || activeSlug) return;
        playEvent('select', e.nativeEvent.clientX);
        track('About opened', { from: 'booth' });
        router.push('/about');
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (activeSlug) return;
        if (!hovered) playEvent('hover', e.nativeEvent.clientX);
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      {/* frame */}
      <RoundedBox args={[w + border * 2, h + border * 2, d]} radius={0.002} smoothness={2} position={[0, (h + border * 2) / 2, 0]} material={mats.frame} castShadow receiveShadow />
      {/* paper, recessed behind the glass */}
      <mesh position={[0, h / 2 + border, d / 2 + 0.0004]} material={mats.paper}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* glass */}
      <mesh position={[0, h / 2 + border, d / 2 + 0.0016]} material={mats.glass} renderOrder={2}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <Html position={[0, h + border * 2 + 0.02, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }} portal={{ current: document.querySelector('.booth-canvas') as HTMLElement }}>
        <div className="specchip" data-visible={hovered && !activeSlug}>
          <span className="specchip__title">About</span>
        </div>
      </Html>
    </group>
  );
}
