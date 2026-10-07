'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Box3, Object3D, SpotLight, Vector3 } from 'three';
import { lampById, strikeChannels } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { isMobileTier } from '@/lib/perfTier';
import { markDirty } from '@/lib/dirty';
import { focusState } from './Post';
import { hoverFocus } from './focus';

/**
 * D2 (08): a soft extra key on the hovered sample: a small, wide-penumbra spot in front of it and
 * above, about +12% on its front, in the lamp's own key colour, ramping with the masked focus
 * (250ms in, 300ms out). Room lamps only (never under UV, SCREEN or AFTER DARK). Always in the scene
 * (intensity 0 at rest): toggling a light's visibility changes the light count and recompiles every
 * material, a visible hitch on the first hover.
 */
const box = new Box3();
const centre = new Vector3();
const size = new Vector3();
export function HoverLight() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const light = useMemo(() => {
    const l = new SpotLight(0xffffff, 0, 0, 0.42, 1, 2);
    l.castShadow = false;
    return l;
  }, []);
  const target = useMemo(() => new Object3D(), []);
  light.target = target;
  const mobile = isMobileTier();
  useFrame(() => {
    if (mobile) return;
    const { lamp, keySlug } = useBooth.getState();
    const P = lampById(lamp);
    const slug = hoverFocus.slug ?? keySlug;
    const w = slug ? focusState.weights.get(slug) ?? 0 : 0;
    const on = !P.dark && w > 0.001;
    if (!on) {
      if (light.intensity > 0) {
        light.intensity = 0;
        markDirty('hover light off', ['reflector', 'shadow'], 1);
      }
      return;
    }
    const slot = scene.children.find((c) => c.userData.slug === slug);
    const root = slot;
    if (!root) return;
    let lift: Object3D | null = null;
    root.traverse((o) => {
      if (!lift && o.userData.focusRoot) lift = o;
    });
    if (!lift) return;
    box.setFromObject(lift).getCenter(centre);
    box.getSize(size);
    target.position.copy(centre);
    light.position.set(centre.x, centre.y + 0.25 + size.y * 0.5, centre.z + 0.45);
    // about +12% of the key's light on the front, eased like the focus strength
    const e = w * w * (3 - 2 * w);
    // part of the lamp: never ahead of the tubes during the first-visit strike
    const { opening, strikeProgress } = useBooth.getState();
    light.intensity = P.keyLight.intensity * 0.075 * e * (opening ? strikeChannels('opening', strikeProgress).light : 1);
    light.color.setRGB(...P.keyLight.colour);
    target.updateMatrixWorld();
    markDirty('hover light', ['reflector'], 1);
    if (e < 1) invalidate();
  });
  if (mobile) return null;
  return (
    <>
      <primitive object={light} />
      <primitive object={target} />
    </>
  );
}
