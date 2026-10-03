'use client';

import { ContactShadows, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Plane,
  Quaternion,
  Raycaster,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type HemisphereLight,
  type RectAreaLight,
  type SpotLight,
} from 'three';
import { kelvinToAdapted } from '@/lib/kelvin';
import { lampById, strikeEnvelope, strikeKelvin } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { postState } from './Post';
import { onScreenFrame, sampleScreens, screens, setScreensPlaying } from './screens';
import { BOOTH, TRAY } from './staging';
import { uvUniforms } from './uvMaterial';

const UP = new Vector3(0, 1, 0);

/** 1×1 white cookie: a spot map that changes nothing (keeps the shader permutation fixed across lamps). */
function whiteCookie() {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  return t;
}

function hazeMaterial() {
  return new ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColour: { value: new Color(1, 1, 1) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uColour;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float facing = pow(abs(dot(vN, vV)), 1.6);   // denser through the middle of the beam
        float along = mix(0.25, 1.0, pow(vY, 1.4));  // brighter near the lamp
        gl_FragColor = vec4(uColour * uOpacity * facing * along * 0.16, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/**
 * One rig, seven lamps. The booth has a fixed set of fixtures (ceiling panel,
 * one shadow-casting key, wall bounce, screen spill, haze); each lamp preset
 * reconfigures them: shape, position, cone, shadow hardness, colour, level.
 * The old lamp is off the instant the rocker flips; the new one strikes with
 * its own curve, read from the store's strikeProgress.
 */
export function LampRig() {
  const panel = useRef<RectAreaLight>(null);
  const key = useRef<SpotLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const contact = useRef<Group>(null);
  const haze = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const gobo = useTexture('/textures/gobo_torch.png');
  gobo.colorSpace = SRGBColorSpace;
  const white = useMemo(whiteCookie, []);
  const keyTarget = useMemo(() => new Object3D(), []);
  const hazeMat = useMemo(hazeMaterial, []);
  const hazeGeo = useMemo(() => new ConeGeometry(1, 1, 48, 1, true).translate(0, -0.5, 0), []);

  // hand lamp: critically damped follow of the pointer
  const hand = useRef({ pos: new Vector3(0, 0.15, 0), vel: new Vector3(), goal: new Vector3(0, 0.15, 0) });
  const ndc = useRef(new Vector2(0, -0.2));
  const ray = useMemo(() => new Raycaster(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const tmp = useMemo(() => ({ v: new Vector3(), c: new Color(), q: new Quaternion(), dir: new Vector3() }), []);

  useEffect(() => useBooth.subscribe(() => invalidate()), [invalidate]);
  useEffect(() => onScreenFrame(() => invalidate()), [invalidate]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (useBooth.getState().lamp === 'AFTERDARK') invalidate();
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl, invalidate]);

  useFrame((_, dt) => {
    const { lamp, strikeProgress, activeSlug } = useBooth.getState();
    const P = lampById(lamp);
    const env = strikeEnvelope(P.strike.curve, strikeProgress);
    const ramp = strikeKelvin(P.strike.curve, strikeProgress);

    // ── ceiling panel ───────────────────────────────
    const pl = panel.current!;
    pl.intensity = P.panel.intensity * env;
    pl.color.setRGB(...P.panel.colour);
    pl.width = P.panel.w;
    pl.height = P.panel.d;
    pl.position.set(0, BOOTH.height - 0.01, P.panel.z);

    // ── key light ───────────────────────────────────
    const k = key.current!;
    const K = P.keyLight;
    k.intensity = K.intensity * env;
    if (ramp) k.color.setRGB(...kelvinToAdapted(ramp));
    else k.color.setRGB(...K.colour);
    k.angle = K.angle;
    k.penumbra = K.penumbra;
    k.decay = K.decay;
    k.shadow.radius = K.shadowRadius;
    k.shadow.autoUpdate = k.intensity > 0;
    if (k.intensity > 0) k.shadow.needsUpdate = true;

    let handMoving = false;
    if (lamp === 'AFTERDARK') {
      // aim plane: the lineup row, or the tray when an object is on it
      plane.constant = -(activeSlug ? TRAY.z : 0);
      ray.setFromCamera(ndc.current, camera);
      if (ray.ray.intersectPlane(plane, tmp.v)) hand.current.goal.copy(tmp.v).setY(Math.max(0.02, tmp.v.y));
      // critically damped spring (ω = 9): weighty, no overshoot
      const h = hand.current;
      const w = 9;
      const step = Math.min(dt, 1 / 30);
      tmp.dir.copy(h.goal).sub(h.pos).multiplyScalar(w * w * step).addScaledVector(h.vel, -2 * w * step);
      h.vel.add(tmp.dir);
      h.pos.addScaledVector(h.vel, step);
      handMoving = h.vel.lengthSq() > 1e-6 || h.pos.distanceToSquared(h.goal) > 1e-6;
      k.position.set(h.pos.x * 0.35, K.position[1], (activeSlug ? TRAY.z : 0) + K.position[2]);
      keyTarget.position.copy(h.pos);
      k.map = gobo;
    } else {
      k.position.set(...K.position);
      keyTarget.position.set(...K.target);
      k.map = white;
    }
    keyTarget.updateMatrixWorld();

    // ── bounce fill ─────────────────────────────────
    const f = fill.current!;
    f.intensity = P.fill.intensity * env;
    f.color.setRGB(...P.fill.sky);
    f.groundColor.setRGB(...P.fill.ground);

    // ── contact shadows ─────────────────────────────
    contact.current?.traverse((o) => {
      if (o instanceof Mesh && o.material instanceof MeshBasicMaterial) o.material.opacity = P.contact * (0.25 + 0.75 * env);
    });

    // ── haze cone along the key light ───────────────
    const hz = haze.current!;
    const hazeLevel = P.haze * env;
    hz.visible = hazeLevel > 0.001;
    if (hz.visible) {
      tmp.dir.copy(keyTarget.position).sub(k.position);
      const len = tmp.dir.length();
      tmp.dir.normalize();
      hz.position.copy(k.position);
      hz.quaternion.setFromUnitVectors(UP, tmp.dir.clone().negate());
      const r = Math.tan(K.angle) * len;
      hz.scale.set(r, len, r);
      hazeMat.uniforms.uOpacity.value = hazeLevel;
      (hazeMat.uniforms.uColour.value as Color).copy(k.color);
    }

    // ── screens ─────────────────────────────────────
    setScreensPlaying(P.screens.playing);
    if (P.screens.playing) sampleScreens();
    else if (P.screens.spill > 0) sampleScreens(true);
    for (const s of screens) {
      const keep = 1 - ((s.material.userData.dim as number | undefined) ?? 0);
      s.material.color.setScalar(P.screens.gain * keep);
      s.light.intensity = P.screens.spill * env * keep;
      s.light.color.copy(s.colour);
    }

    // ── fluorescence + post ─────────────────────────
    uvUniforms.uUV.value = P.uv * env;
    postState.bloomIntensity = P.bloom.intensity * env;
    postState.bloomThreshold = P.bloom.threshold;
    postState.grain = P.grain;
    postState.matrix.fromArray(P.matrix).transpose(); // fromArray is column-major; presets are row-major

    if (strikeProgress < 1 || handMoving) invalidate();
  });

  return (
    <>
      <rectAreaLight ref={panel} rotation={[-Math.PI / 2, 0, 0]} />
      <primitive object={keyTarget} />
      <spotLight
        ref={key}
        target={keyTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.012}
        shadow-camera-near={0.3}
        shadow-camera-far={12}
        map={white}
      />
      <hemisphereLight ref={fill} />
      <mesh ref={haze} geometry={hazeGeo} material={hazeMat} visible={false} renderOrder={3} />
      <ContactShadows
        ref={contact}
        position={[0, 0.003, 0.15]}
        scale={[BOOTH.width, 1.7]}
        resolution={1024}
        far={0.45}
        blur={2.2}
        opacity={0.5}
        color="#141413"
      />
    </>
  );
}
