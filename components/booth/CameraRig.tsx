'use client';

import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import { FOV, LINEUP_WIDTH } from './layout';

/** Aim above the objects so the lineup sits in the lower third, under the DOM headline. */
const TARGET_Y = 0.62;
const MARGIN = 1.25;

/**
 * Locked long-lens camera, level horizon, flat front. No orbit.
 * Distance is solved so the whole lineup fits the viewport width.
 * Pointer parallax (≤1.5°) arrives in Phase 1.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const vHalf = (FOV * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const dist = (LINEUP_WIDTH * MARGIN) / 2 / Math.tan(hHalf);
    camera.fov = FOV;
    camera.near = 0.1;
    camera.far = 100;
    camera.position.set(0, TARGET_Y + dist * 0.02, dist);
    camera.lookAt(0, TARGET_Y, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}
