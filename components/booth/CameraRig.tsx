'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { frameRect, stageRect } from '@/lib/views';
import { cabinetShot, lineupShot, trayShot } from './shots';
import { FOV, STAGING } from './staging';

const PARALLAX_YAW = MathUtils.degToRad(1.2);
const PARALLAX_PITCH = MathUtils.degToRad(0.5);

/**
 * Locked long-lens camera. Level horizon, flat front, no orbit.
 * Home: the cabinet framed as an object on the page (box set by the layout).
 * Project pages: the tray shot inside the booth. Moves between them on rails
 * (critically damped, no overshoot), lens shift included. Pointer parallax ≤1.2°.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();

  const pointer = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const current = useRef<{ target: Vector3; dist: number; ox: number; oy: number } | null>(null);
  const goalTarget = useRef(new Vector3());

  useEffect(() => {
    camera.fov = FOV;
    camera.near = 0.05;
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

  const focusSlug = useBooth((s) => s.focusSlug);
  useEffect(() => invalidate(), [activeSlug, focusSlug, size.width, size.height, invalidate]);

  useFrame((_, dt) => {
    // The booth renders into the stage rect, so its aspect is the stage's, not the canvas's.
    const r = stageRect() ?? { left: 0, top: 0, width: size.width, height: size.height };
    const aspect = r.height > 0 ? r.width / r.height : size.width / size.height;

    let goal: { target: [number, number, number]; dist: number; offset: [number, number] };
    const f = frameRect();
    if (activeSlug) goal = { ...trayShot(activeSlug, aspect), offset: [0, 0] };
    else if (f) {
      const fs = useBooth.getState().focusSlug;
      const st = fs ? STAGING[fs] : null;
      goal = cabinetShot(r, { left: f.left - r.left, top: f.top - r.top, width: f.width, height: f.height }, st ? { x: st.x, z: st.z + st.object.d / 2 } : null);
    }
    else goal = { ...lineupShot(aspect), offset: [0, 0] };
    goalTarget.current.set(...goal.target);

    const k = reduced || !current.current ? 1 : 1 - Math.exp(-dt * 3.2);
    if (!current.current) current.current = { target: goalTarget.current.clone(), dist: goal.dist, ox: goal.offset[0], oy: goal.offset[1] };
    const c = current.current;
    c.target.lerp(goalTarget.current, k);
    c.dist += (goal.dist - c.dist) * k;
    c.ox += (goal.offset[0] - c.ox) * k;
    c.oy += (goal.offset[1] - c.oy) * k;

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
    camera.aspect = aspect;
    if (Math.abs(c.ox) > 0.25 || Math.abs(c.oy) > 0.25) camera.setViewOffset(r.width, r.height, c.ox, c.oy, r.width, r.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();

    const moving =
      c.target.distanceTo(goalTarget.current) > 1e-4 ||
      Math.abs(c.dist - goal.dist) > 1e-3 ||
      Math.abs(c.ox - goal.offset[0]) + Math.abs(c.oy - goal.offset[1]) > 0.3 ||
      Math.abs(pointer.current.x - smooth.current.x) > 1e-3 ||
      Math.abs(pointer.current.y - smooth.current.y) > 1e-3;
    if (moving) invalidate();
  });

  return null;
}
