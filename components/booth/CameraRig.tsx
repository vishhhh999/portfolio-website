'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { useBooth } from '@/lib/store';
import { stageRect } from '@/lib/views';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { lineupShot, trayShot } from './shots';
import { FOV } from './staging';

const PARALLAX_YAW = MathUtils.degToRad(1.5);
const PARALLAX_PITCH = MathUtils.degToRad(0.6);

/**
 * Locked long-lens camera. Level horizon, flat front, no orbit.
 * Two shots (lineup, tray), moved between on rails: critically damped, no
 * overshoot. Pointer parallax ≤1.5°.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();

  const pointer = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const current = useRef<{ target: Vector3; dist: number } | null>(null);
  const goalTarget = useRef(new Vector3());

  useEffect(() => {
    camera.fov = FOV;
    camera.near = 0.1;
    camera.far = 60;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    if (reduced) {
      pointer.current = { x: 0, y: 0 };
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.current = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
      invalidate();
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced, invalidate]);

  useEffect(() => invalidate(), [activeSlug, size.width, size.height, invalidate]);

  useFrame((_, dt) => {
    // The booth renders into the stage rect, so its aspect is the stage's, not the canvas's.
    const r = stageRect();
    const aspect = r && r.height > 0 ? r.width / r.height : size.width / size.height;
    if (Math.abs(camera.aspect - aspect) > 1e-4) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    const goal = activeSlug ? trayShot(activeSlug, aspect) : lineupShot(aspect);
    goalTarget.current.set(...goal.target);

    const k = reduced || !current.current ? 1 : 1 - Math.exp(-dt * 3.2);
    if (!current.current) current.current = { target: goalTarget.current.clone(), dist: goal.dist };
    const c = current.current;
    c.target.lerp(goalTarget.current, k);
    c.dist += (goal.dist - c.dist) * k;

    const kp = reduced ? 1 : 1 - Math.exp(-dt * 4);
    smooth.current.x += (pointer.current.x - smooth.current.x) * kp;
    smooth.current.y += (pointer.current.y - smooth.current.y) * kp;
    const yaw = smooth.current.x * PARALLAX_YAW;
    const pitch = smooth.current.y * PARALLAX_PITCH;

    camera.position.set(
      c.target.x + Math.sin(yaw) * c.dist,
      c.target.y + Math.sin(pitch) * c.dist,
      c.target.z + Math.cos(yaw) * c.dist,
    );
    camera.lookAt(c.target);

    const moving =
      c.target.distanceTo(goalTarget.current) > 1e-4 ||
      Math.abs(c.dist - goal.dist) > 1e-3 ||
      Math.abs(pointer.current.x - smooth.current.x) > 1e-3 ||
      Math.abs(pointer.current.y - smooth.current.y) > 1e-3;
    if (moving) invalidate();
  });

  return null;
}
