'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AddEquation,
  CustomBlending,
  OneFactor,
  ZeroFactor,
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
import { lampById, strikeChannels, strikeKelvin } from '@/lib/lampPresets';
import { useBooth } from '@/lib/store';
import { ceilingMaterial, diffuserMaterial, getBlobMaterial, lightmapTint } from './BoothRoom';
import { postState } from './Post';
import { onScreenFrame, screens } from './screens';
import { BOOTH, TRAY } from './staging';
import { boothEnvironment, ENV_INTENSITY } from './environment';
import { uvUniforms } from './uvMaterial';
import { PRINT_FLOORS, proofUniforms } from './proofUniforms';
import { isMobileTier } from '@/lib/perfTier';

const D50_PRINT = lampById('D50').print;

/** Bumped on resize and DPR steps: cached shadow maps must re-render. */
export const shadowEpoch = { value: 0 };
export const invalidateShadows = () => void shadowEpoch.value++;
const tmpSpill = new Color();

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
    // additive light, but alpha untouched: haze must never change the coverage mask (it would print on the page)
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
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
  /** Mobile tier: one spill light for all screens (instead of one area light per screen). */
  const spill = useRef<RectAreaLight>(null);
  const mobile = isMobileTier();
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
  const tmpColour = useMemo(() => new Color(), []);

  // hand lamp: critically damped follow of the pointer
  const hand = useRef({ pos: new Vector3(0, 0.15, 0), vel: new Vector3(), goal: new Vector3(0, 0.15, 0) });
  const ndc = useRef(new Vector2(0, -0.3));
  const ray = useMemo(() => new Raycaster(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const tmp = useMemo(() => ({ v: new Vector3(), dir: new Vector3() }), []);
  const lastLamp = useRef<string | null>(null);
  const shadowKey = useRef<{ lamp: string | null; slug: string | null; focus: string | null; epoch: number }>({ lamp: null, slug: null, focus: null, epoch: -1 });
  const shadowUntil = useRef(0);
  const handWasMoving = useRef(false);
  const lastHandLamp = useRef<string | null>(null);
  // pointer in whole-page NDC (for the hand lamp over the proof strip)
  const ndcPage = useRef(new Vector2(0, 0));
  const printHand = useMemo(() => ({ pos: new Vector2(), vel: new Vector2(), goal: new Vector2() }), []);
  const tmp2 = useMemo(() => new Vector2(), []);

  // No scene background: around the cabinet the canvas is transparent and the page (paper) shows.
  useEffect(() => {
    scene.background = null;
  }, [scene]);

  // Image-based light: the booth's own interior as a PMREM, re-tinted per lamp (built once each).
  const lampNow = useBooth((st) => st.lamp);
  useEffect(() => {
    scene.environment = boothEnvironment(gl, lampNow);
    invalidate();
  }, [gl, scene, lampNow, invalidate]);
  useEffect(() => useBooth.subscribe(() => invalidate()), [invalidate]);
  const size = useThree((s) => s.size);
  const dprNow = useThree((s) => s.viewport.dpr);
  useEffect(() => {
    invalidateShadows();
    invalidate();
  }, [size.width, size.height, dprNow, invalidate]);
  useEffect(() => onScreenFrame(() => invalidate()), [invalidate]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = (window.__boothStageRect?.() ?? gl.domElement.getBoundingClientRect()) as DOMRect;
      ndc.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ndcPage.current.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      if (useBooth.getState().lamp === 'AFTERDARK') invalidate();
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl, invalidate]);

  useFrame((_, dt) => {
    const { lamp, strikeProgress, activeSlug } = useBooth.getState();
    const P = lampById(lamp);
    const ch = strikeChannels(P.strike.curve, strikeProgress);
    const env = ch.light;
    const ramp = strikeKelvin(P.strike.curve, strikeProgress);
    const onTray = activeSlug !== null;

    scene.environmentIntensity = ENV_INTENSITY[lamp] * env;
    // a baked shell lightmap (if any) is bounce light: the lamp's colour at its bounce level
    lightmapTint.value.setRGB(...P.fill.sky).multiplyScalar((P.fill.intensity + P.panel.intensity * 0.25) * env);

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
    k.shadow.intensity = K.shadowIntensity;
    // The booth is static: the shadow map (VSM: a depth pass + two blur passes) re-renders only
    // when something changes it: a lamp strike or switch, samples moving to/from the tray, or the
    // hand lamp moving. Never under D50 (shadow intensity 0). The measured top per-frame cost otherwise.
    // Anything that moves a caster or the shadow camera re-renders the map for a while: a lamp
    // change, the tray, a swipe to another sample, a resize or a DPR step (shadowEpoch).
    const nowMs = performance.now();
    const { focusSlug } = useBooth.getState();
    const sk = shadowKey.current;
    if (lamp !== sk.lamp || activeSlug !== sk.slug || focusSlug !== sk.focus || shadowEpoch.value !== sk.epoch) {
      shadowKey.current = { lamp, slug: activeSlug, focus: focusSlug, epoch: shadowEpoch.value };
      shadowUntil.current = nowMs + 2500;
    }
    k.shadow.autoUpdate = false;
    const shadowsMatter = k.intensity > 0 && K.shadowIntensity > 0;
    if (shadowsMatter && (strikeProgress < 1 || nowMs < shadowUntil.current || handWasMoving.current)) k.shadow.needsUpdate = true;

    let handMoving = false;
    const handJustOn = lamp === 'AFTERDARK' && lastHandLamp.current !== 'AFTERDARK';
    lastHandLamp.current = lamp;
    if (lamp === 'AFTERDARK') {
      plane.constant = -(onTray ? TRAY.z : 0);
      ray.setFromCamera(ndc.current, camera);
      if (ray.ray.intersectPlane(plane, tmp.v)) hand.current.goal.copy(tmp.v).setY(Math.max(0.02, tmp.v.y));
      // switching the hand lamp on: it starts where the pointer is, not flying in from a corner
      if (handJustOn) {
        hand.current.pos.copy(hand.current.goal);
        hand.current.vel.set(0, 0, 0);
      }
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

    // ── screens: always on (the logo as an emissive layer under glass); spill only where the lamp says ──
    let spillSum = 0;
    const spillColour = tmpSpill.setRGB(0, 0, 0);
    for (const s of screens) {
      const keep = 1 - ((s.material.userData.dim as number | undefined) ?? 0);
      s.material.emissiveIntensity = P.screens.gain * (0.35 + 0.65 * ch.screens) * keep;
      if (s.light) {
        s.light.intensity = P.screens.spill * ch.spill * keep;
        s.light.color.copy(s.colour);
      }
      spillSum += keep;
      spillColour.add(s.colour);
    }
    if (spill.current) {
      // the screens' area together, from one light across the back row
      spill.current.intensity = screens.size ? P.screens.spill * ch.spill * spillSum * 0.45 : 0;
      spill.current.color.copy(screens.size ? spillColour.multiplyScalar(1 / screens.size) : spillColour);
    }

    // ── proof-strip photos: the same lamp, as a print light model ──
    // Until the visitor picks a lamp themselves (a project's native lamp is set for them), the
    // photos stay D50-faithful: neutral white, true colour. After a pick they follow the lamp,
    // with readability floors under the dark lamps.
    const picked = useBooth.getState().lampPicked;
    const pr = picked ? P.print : D50_PRINT;
    const penv = picked ? env : 1;
    const dpr = gl.getPixelRatio();
    const level = pr.level * penv;
    if (ramp && picked) proofUniforms.uColour.value.setRGB(...kelvinToAdapted(ramp)).multiplyScalar(level);
    else proofUniforms.uColour.value.setRGB(...pr.colour).multiplyScalar(level);
    proofUniforms.uAmbient.value = pr.ambient * penv;
    proofUniforms.uFloor.value = picked ? (PRINT_FLOORS[lamp] ?? 0) : 0;
    proofUniforms.uProofUV.value = picked ? P.uv * ch.uv : 0;
    proofUniforms.uGrad.value.set(pr.grad[0], pr.grad[1], pr.grad[2], 0);
    if (pr.spot) {
      const W = window.innerWidth * dpr;
      const H = window.innerHeight * dpr;
      const r = pr.spot.r * Math.min(W, H);
      if (picked && lamp === 'AFTERDARK') {
        // the hand lamp follows the pointer over the photos too (same critically damped lag)
        printHand.goal.set(((ndcPage.current.x + 1) / 2) * W, ((ndcPage.current.y + 1) / 2) * H);
        if (handJustOn) {
          printHand.pos.copy(printHand.goal);
          printHand.vel.set(0, 0);
        }
        const w = 9;
        const step = Math.min(dt, 1 / 30);
        tmp2.copy(printHand.goal).sub(printHand.pos).multiplyScalar(w * w * step).addScaledVector(printHand.vel, -2 * w * step);
        printHand.vel.add(tmp2);
        printHand.pos.addScaledVector(printHand.vel, step);
        if (printHand.vel.lengthSq() > 1e-2) handMoving = true;
        proofUniforms.uSpot.value.set(printHand.pos.x, printHand.pos.y, r, pr.spot.soft);
        proofUniforms.uCookie.value = gobo;
        proofUniforms.uUseCookie.value = 1;
      } else {
        proofUniforms.uSpot.value.set(pr.spot.x * W, (1 - pr.spot.y) * H, r, pr.spot.soft);
        proofUniforms.uUseCookie.value = 0;
      }
      proofUniforms.uSpotMix.value = 1;
      proofUniforms.uSpotOutside.value = pr.spot.outside;
    } else {
      proofUniforms.uSpotMix.value = 0;
      proofUniforms.uUseCookie.value = 0;
    }

    // ── fluorescence + post ─────────────────────────
    uvUniforms.uUV.value = P.uv * ch.uv;
    // mobile: bloom under UV makes no visible difference (A/B: 0.06% of pixels change), so it is off there
    postState.bloomIntensity = mobile && lamp === 'UV' ? 0 : P.bloom.intensity * env;
    postState.bloomThreshold = P.bloom.threshold;
    postState.grain = P.grain;
    postState.exposure = P.exposure * ch.exposure;
    postState.matrix.fromArray(P.matrix).transpose(); // fromArray is column-major; presets are row-major
    if (useBooth.getState().lampPicked) proofUniforms.uNeutralize.value.identity();
    else proofUniforms.uNeutralize.value.copy(postState.matrix).invert();

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

    handWasMoving.current = handMoving;
    if (strikeProgress < 1 || handMoving) invalidate();
  });

  return (
    <>
      <rectAreaLight ref={panel} rotation={[-Math.PI / 2, 0, 0]} />
      {mobile && <rectAreaLight ref={spill} width={0.8} height={0.16} position={[0, 0.42, -0.2]} rotation={[0, Math.PI, 0]} intensity={0} />}
      <primitive object={keyTarget} />
      <spotLight
        ref={key}
        target={keyTarget}
        castShadow
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.012}
        shadow-camera-near={0.1}
        shadow-camera-far={3}
        map={white}
      />
      <hemisphereLight ref={fill} />
      <directionalLight ref={front} position={[0, 0.6, 6]} />
      <mesh ref={haze} geometry={hazeGeo} material={hazeMat} visible={false} renderOrder={3} />
    </>
  );
}
