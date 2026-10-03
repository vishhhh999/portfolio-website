'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { FOV, LINEUP_WIDTH, TRAY_Z, objectSize } from './layout';

/** Where the floor line sits in the lineup shot, as a fraction down from the top. */
const FLOOR_LINE = 0.74;
const PARALLAX_YAW = MathUtils.degToRad(1.5);
const PARALLAX_PITCH = MathUtils.degToRad(0.6);

type Shot = { target: Vector3; dist: number };

/**
 * Locked long-lens camera. Level horizon, flat front, no orbit.
 * Two shots: the full lineup, and the tray. Moves between them on rails
 * (critically damped, no overshoot). Pointer parallax ≤1.5°.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();

  const pointer = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const current = useRef<Shot | null>(null);

  useEffect(() => {
    camera.fov = FOV;
    camera.near = 0.1;
    camera.far = 100;
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
    const aspect = size.width / size.height;
    const tanV = Math.tan(MathUtils.degToRad(FOV / 2));
    const tanH = tanV * aspect;

    let goal: Shot;
    if (activeSlug) {
      const { width, height } = objectSize(activeSlug);
      const fitH = Math.max(height * 2.4, 0.5);
      const fitW = Math.max(width * 2.2, 0.8);
      const dist = Math.max(fitH / 2 / tanV, fitW / 2 / tanH);
      goal = { target: new Vector3(0, height * 0.55, TRAY_Z), dist };
    } else {
      const dist = (LINEUP_WIDTH * 1.22) / 2 / tanH;
      // Level camera: lift the eye so the floor line lands at FLOOR_LINE down the frame.
      const y = (FLOOR_LINE - 0.5) * 2 * dist * tanV;
      goal = { target: new Vector3(0, y, 0), dist };
    }

    const cur = current.current;
    const k = reduced || !cur ? 1 : 1 - Math.exp(-dt * 3.2);
    if (!cur) current.current = { target: goal.target.clone(), dist: goal.dist };
    else {
      cur.target.lerp(goal.target, k);
      cur.dist += (goal.dist - cur.dist) * k;
    }
    const c = current.current!;

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
      c.target.distanceTo(goal.target) > 1e-4 ||
      Math.abs(c.dist - goal.dist) > 1e-3 ||
      Math.abs(pointer.current.x - smooth.current.x) > 1e-3 ||
      Math.abs(pointer.current.y - smooth.current.y) > 1e-3;
    if (moving) invalidate();
  });

  return null;
}
