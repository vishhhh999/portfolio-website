'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { useBooth } from '@/lib/store';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { frameRect, stageRect } from '@/lib/views';
import { cabinetShot, lineupShot, shelfShot, trayShot } from './shots';
import { spinDragging } from '@/lib/spin';
import { activeLayout, FOV, STAGING } from './staging';

const PARALLAX_YAW = MathUtils.degToRad(1.5);
const PARALLAX_PITCH = MathUtils.degToRad(0.6);
const UP = new Vector3(0, 1, 0);

/**
 * Locked camera: a ~38mm lens a little above the plinth line, looking 7° down. No orbit.
 * Home: the cabinet framed as an object on the page (box set by the layout).
 * Project pages: the tray shot inside the booth. Moves between them on rails
 * (critically damped, no overshoot), lens shift included. Pointer parallax ≤1.5°, desktop
 * pointers only, none under reduced motion.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const activeSlug = useBooth((s) => s.activeSlug);
  const reduced = useReducedMotion();

  const pointer = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const current = useRef<{ target: Vector3; position: Vector3; ox: number; oy: number } | null>(null);
  const goalTarget = useRef(new Vector3());
  const goalPos = useRef(new Vector3());
  const tmp = useRef({ p: new Vector3(), right: new Vector3() });
  const layoutJump = useRef<string | null>(null);

  useEffect(() => {
    camera.fov = FOV;
    // B2 (09): the nearest the camera ever gets to anything is ~0.3m (the tray's front edge in the
    // closest tray shot), so the near plane sits at 0.15m, not 0.05: three times the depth precision.
    // A 24-bit depth step at the device screens from the home view (~3m) is 0.004mm (0.012mm before),
    // against the 1mm screen-to-glass gap of the rebuilt GLBs. No logarithmic depth is needed.
    camera.near = 0.15;
    camera.far = 12;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    if (reduced) {
      pointer.current = { x: 0, y: 0 };
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || spinDragging()) return; // turning an object never moves the camera
      pointer.current = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
      invalidate();
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced, invalidate]);

  const focusSlug = useBooth((s) => s.focusSlug);
  useEffect(() => invalidate(), [activeSlug, focusSlug, size.width, size.height, invalidate]);

  useFrame((_, rawDt) => {
    // a non-monotonic or stalled clock never jumps or inverts the motion: 0 ≤ dt ≤ 100ms
    const dt = Math.min(0.1, Math.max(0, rawDt || 0));
    // The booth renders into the stage rect, so its aspect is the stage's, not the canvas's.
    let r = stageRect() ?? { left: 0, top: 0, width: size.width, height: size.height };
    let aspect = r.height > 0 ? r.width / r.height : size.width / size.height;

    let goal: { target: [number, number, number]; position: [number, number, number]; offset: [number, number] };
    const f = frameRect();
    const L = activeLayout();
    // L3 (09B): on the shelf the picture is the whole canvas (the frame is taller than the screen),
    // and the camera is locked to the page's scroll, not eased after it
    const onShelf = L.kind === 'shelf' && !activeSlug && !!f && !!L.shelf;
    let full: [number, number] | null = null;
    if (onShelf) {
      const sh = shelfShot(L.shelf!, f!, size, reduced, window.scrollY);
      full = sh.full;
      r = { left: 0, top: 0, width: full[0], height: full[1] };
      aspect = full[0] / full[1];
      goal = sh;
    } else if (activeSlug) goal = { ...trayShot(activeSlug, aspect), offset: [0, 0] };
    else if (f) {
      const fs = useBooth.getState().focusSlug;
      const st = fs ? STAGING[fs] : null;
      goal = cabinetShot(r, { left: f.left - r.left, top: f.top - r.top, width: f.width, height: f.height }, st ? { x: st.x, z: st.z + st.object.d / 2 } : null);
    } else goal = lineupShot(aspect);
    goalTarget.current.set(...goal.target);
    goalPos.current.set(...goal.position);

    // the dolly between the lineup and the tray: ~95% of the way in 0.7s, critically damped
    const k = reduced || onShelf || !current.current || layoutJump.current !== L.key ? 1 : 1 - Math.exp(-dt * 4.3);
    // a new arrangement is a cut (the crossfade over the canvas covers it), never a dolly
    layoutJump.current = L.key;
    if (!current.current) current.current = { target: goalTarget.current.clone(), position: goalPos.current.clone(), ox: goal.offset[0], oy: goal.offset[1] };
    const c = current.current;
    c.target.lerp(goalTarget.current, k);
    c.position.lerp(goalPos.current, k);
    c.ox += (goal.offset[0] - c.ox) * k;
    c.oy += (goal.offset[1] - c.oy) * k;

    const kp = reduced ? 1 : 1 - Math.exp(-dt * 4);
    smooth.current.x += (pointer.current.x - smooth.current.x) * kp;
    smooth.current.y += (pointer.current.y - smooth.current.y) * kp;

    // parallax: swing the camera around its target (yaw about up, pitch about the camera's right)
    const { p, right } = tmp.current;
    p.copy(c.position).sub(c.target);
    // no pointer parallax on the shelf: its front plane stays locked to the page
    const par = onShelf ? 0 : 1;
    p.applyAxisAngle(UP, smooth.current.x * PARALLAX_YAW * par);
    right.crossVectors(UP, p).normalize();
    p.applyAxisAngle(right, smooth.current.y * PARALLAX_PITCH * par);
    camera.position.copy(c.target).add(p);
    camera.lookAt(c.target);
    // One projection for the whole canvas: the booth's picture is the stage rect (aspect, lens
    // shift) and the canvas is a window onto it, so depth, normals (SSAO), raycasts and labels all
    // share one mapping. Outside the stage the views pass scissors the booth away.
    camera.aspect = aspect;
    // the shelf: the screen is a window of a taller virtual image (its eye at a fixed screen height)
    if (full) camera.setViewOffset(full[0], full[1], c.ox, c.oy, size.width, size.height);
    else camera.setViewOffset(r.width, r.height, c.ox - r.left, c.oy - r.top, size.width, size.height);
    camera.updateProjectionMatrix();

    const moving =
      c.target.distanceTo(goalTarget.current) > 1e-4 ||
      c.position.distanceTo(goalPos.current) > 1e-4 ||
      Math.abs(c.ox - goal.offset[0]) + Math.abs(c.oy - goal.offset[1]) > 0.3 ||
      Math.abs(pointer.current.x - smooth.current.x) > 1e-3 ||
      Math.abs(pointer.current.y - smooth.current.y) > 1e-3;
    if (moving) invalidate();
  });

  return null;
}
