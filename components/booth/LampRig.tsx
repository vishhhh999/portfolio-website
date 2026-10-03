'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DataTexture,
  DoubleSide,
  Mesh,
  Object3D,
  Plane,
  Raycaster,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type DirectionalLight,
  type HemisphereLight,
  type RectAreaLight,
  type SpotLight,
  type Texture,
} from 'three';
import { kelvinToAdapted } from '@/lib/kelvin';
import { lampById, strikeEnvelope, strikeKelvin } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { ceilingMaterial, diffuserMaterial, getBlobMaterial } from './BoothRoom';
import { postState } from './Post';
import { onScreenFrame, sampleScreens, screens, screenSource } from './screens';
import { BOOTH, TRAY } from './staging';
import { uvUniforms } from './uvMaterial';

const UP = new Vector3(0, 1, 0);

/** 1×1 white cookie: a spot map that changes nothing (keeps the shader permutation fixed across lamps). */
function whiteCookie() {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/**
 * FLOOD's haze cone. Every term is clamped: under MSAA, varyings are
 * extrapolated past triangle edges, and pow() of a slightly negative value is
 * NaN on real GPUs; one NaN pixel fed into bloom blacks out the whole frame.
 */
function hazeMaterial() {
  return new ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColour: { value: new Color(1, 1, 1) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalMatrix * normal; vV = -mv.xyz; vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uColour;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float along = mix(0.25, 1.0, pow(clamp(vY, 0.0, 1.0), 1.4));
        vec3 c = uColour * uOpacity * facing * facing * along * 0.14;
        gl_FragColor = vec4(clamp(c, 0.0, 4.0), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/**
 * One rig, seven lamps. The booth has a fixed set of fixtures (ceiling panel +
 * visible diffuser, one shadow-casting key, wall bounce, screen spill, haze,
 * contact shadows); each lamp preset reconfigures them: shape, position,
 * cone, shadow softness, colour, level. The old lamp is off the instant the
 * rocker flips; the new one strikes with its own curve (store.strikeProgress).
 */
export function LampRig() {
  const panel = useRef<RectAreaLight>(null);
  const key = useRef<SpotLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const front = useRef<DirectionalLight>(null);
  const haze = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  // Loaded without Suspense: the lights must exist from the very first frame.
  const white = useMemo(whiteCookie, []);
  const gobo = useMemo<Texture>(() => {
    const t = new TextureLoader().load('/textures/gobo_torch.png', () => invalidate());
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [invalidate]);
  const keyTarget = useMemo(() => new Object3D(), []);
  const hazeMat = useMemo(hazeMaterial, []);
  const hazeGeo = useMemo(() => new ConeGeometry(1, 1, 48, 1, true).translate(0, -0.5, 0), []);
  const bg = useMemo(() => new Color(0, 0, 0), []);
  const tmpColour = useMemo(() => new Color(), []);

  // hand lamp: critically damped follow of the pointer
  const hand = useRef({ pos: new Vector3(0, 0.15, 0), vel: new Vector3(), goal: new Vector3(0, 0.15, 0) });
  const ndc = useRef(new Vector2(0, -0.3));
  const ray = useMemo(() => new Raycaster(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const tmp = useMemo(() => ({ v: new Vector3(), dir: new Vector3() }), []);
  const lastLamp = useRef<string | null>(null);

  useEffect(() => {
    scene.background = bg;
    return () => void (scene.background = null);
  }, [scene, bg]);
  useEffect(() => useBooth.subscribe(() => invalidate()), [invalidate]);
  useEffect(() => onScreenFrame(() => invalidate()), [invalidate]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = (window.__boothStageRect?.() ?? gl.domElement.getBoundingClientRect()) as DOMRect;
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
    const onTray = activeSlug !== null;

    // ── ceiling panel + its visible diffuser ────────
    const pl = panel.current!;
    pl.intensity = P.panel.intensity * env;
    pl.color.setRGB(...P.panel.colour);
    pl.width = P.panel.w;
    pl.height = P.panel.d;
    pl.position.set(0, BOOTH.height - 0.006, P.panel.z);
    diffuserMaterial.color.setRGB(...P.panel.colour).multiplyScalar(Math.max(0.06, P.diffuser * env));
    // ceiling: bounce from the floor + spill around the diffuser
    const bounce = (P.fill.intensity * 0.55 + P.diffuser * 0.1 + P.keyLight.intensity * 0.012) * env;
    ceilingMaterial.color.setRGB(0.45, 0.45, 0.44).multiply(tmpColour.setRGB(...P.fill.sky)).multiplyScalar(bounce);

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
      plane.constant = -(onTray ? TRAY.z : 0);
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
      k.position.set(h.pos.x * 0.35, K.position[1], (onTray ? TRAY.z : 0) + K.position[2]);
      keyTarget.position.copy(h.pos);
      k.map = gobo;
    } else {
      // with a sample on the tray, every lamp keeps its geometry but aims at the tray
      const dz = onTray ? TRAY.z * 0.9 : 0;
      k.position.set(K.position[0], K.position[1], K.position[2] + dz);
      if (onTray) keyTarget.position.set(K.target[0] * 0.3, TRAY.top + 0.05, TRAY.z);
      else keyTarget.position.set(...K.target);
      k.map = white;
    }
    keyTarget.updateMatrixWorld();

    // ── bounce fill, room, contact shadows ──────────
    const f = fill.current!;
    f.intensity = P.fill.intensity * env;
    f.color.setRGB(...P.fill.sky);
    f.groundColor.setRGB(...P.fill.ground);
    const fr = front.current!;
    fr.intensity = P.front * env;
    fr.color.setRGB(...P.fill.sky);
    bg.setRGB(...P.room).multiplyScalar(0.15 + 0.85 * env);
    getBlobMaterial().opacity = P.contact * (0.3 + 0.7 * env);

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

    // ── screens: always on; live video + spill only in SCREEN ──
    const src = screenSource(P.screens.live);
    if (P.screens.live) sampleScreens();
    for (const s of screens) {
      const keep = 1 - ((s.material.userData.dim as number | undefined) ?? 0);
      if (s.material.map !== src) s.material.map = src;
      s.material.color.setScalar(P.screens.gain * (0.35 + 0.65 * env) * keep);
      s.light.intensity = P.screens.spill * env * keep;
      s.light.color.copy(s.colour);
    }

    // ── fluorescence + post ─────────────────────────
    uvUniforms.uUV.value = P.uv * env;
    postState.bloomIntensity = P.bloom.intensity * env;
    postState.bloomThreshold = P.bloom.threshold;
    postState.grain = P.grain;
    postState.matrix.fromArray(P.matrix).transpose(); // fromArray is column-major; presets are row-major

    // Diagnostics: log the rig once each time FLOOD (or any lamp, with ?lampdebug) settles.
    if (strikeProgress >= 1 && lastLamp.current !== lamp) {
      lastLamp.current = lamp;
      if (lamp === 'FLOOD' || window.location.search.includes('lampdebug')) {
        postState.diagnose = {
          lamp,
          key: {
            intensity: k.intensity,
            colour: k.color.toArray(),
            position: k.position.toArray(),
            target: keyTarget.position.toArray(),
            angle: k.angle,
            penumbra: k.penumbra,
            decay: k.decay,
            distance: k.distance,
            shadowRadius: k.shadow.radius,
            shadowMap: k.shadow.mapSize.toArray(),
          },
          panel: { intensity: pl.intensity, w: pl.width, h: pl.height },
          fill: f.intensity,
          haze: { visible: hz.visible, opacity: hazeLevel, scale: hz.scale.toArray() },
          bloom: postState.bloomIntensity,
        };
      }
    }

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
        shadow-bias={-0.0004}
        shadow-normalBias={0.006}
        shadow-blurSamples={16}
        shadow-camera-near={0.05}
        shadow-camera-far={6}
        map={white}
      />
      <hemisphereLight ref={fill} />
      <directionalLight ref={front} position={[0, 0.6, 6]} />
      <mesh ref={haze} geometry={hazeGeo} material={hazeMat} visible={false} renderOrder={3} />
    </>
  );
}
