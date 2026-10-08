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
import { LAMPS, lampById, strikeChannels, strikeKelvin } from '@/lib/lampPresets';
import type { Lamp } from '@/lib/types';
import { useBooth } from '@/lib/store';
import { ceilingMaterial, diffuserMaterial, getBlobMaterial, hoodGlow, lightmapTint } from './BoothRoom';
import { postState } from './Post';
import { onScreenFrame, screens } from './screens';
import { activeLayout, BOOTH, TRAY } from './staging';
import { boothEnvironment, captureEnvironment, capturedEnvironment, ENV_INTENSITY } from './environment';
import { modelsSettled } from './models';
import { perfOff } from '@/lib/perfFlags';
import { markDirty, takeDirty } from '@/lib/dirty';
import { revealed } from '@/lib/reveal';
import { logEvent } from '@/lib/eventLog';
import { uvUniforms } from './uvMaterial';
import { PRINT_FLOORS, proofUniforms } from './proofUniforms';
import { torch } from '@/lib/torch';
import { isMobileTier } from '@/lib/perfTier';
const MOBILE_TIER = typeof window !== 'undefined' && isMobileTier();
/** E (09): desktop lights each screen with its own area light (SCREEN only); phones keep one combined light. */
const perScreenLights = typeof window !== 'undefined' && !MOBILE_TIER && !perfOff('screenlights');
/** The combined screen light's level per lit screen (phones; SCREEN reads L* 15–25 on the pouch, book and boxes). */
const SPILL_GAIN = 0.75;
/** E (09): each screen's own light under SCREEN on desktop (calibrated: pouch, book and SOOK read L* 15–25). */
const SCREEN_LIGHT_GAIN = 0.2;

const D50_PRINT = lampById('D50').print;
const D50_BOUNCE = (() => {
  const P = lampById('D50');
  return P.fill.intensity * 0.55 + P.diffuser * 0.1 + P.keyLight.intensity * 0.012;
})();

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
  /** One spill light for all screens (B2, 08: desktop too), in the scene only while it is lit. */
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
    scene.environment = capturedEnvironment(lampNow) ?? boothEnvironment(gl, lampNow);
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

  /** The whole rig for one frame; `override` forces the strike progress (the J2 capture pass at full output). */
  const applyRig = (rawDt: number, override?: number, lampOverride?: Lamp) => {
    // a non-monotonic or stalled clock never jumps or inverts the motion: 0 ≤ dt ≤ 100ms
    const dt = Math.min(0.1, Math.max(0, rawDt || 0));
    const { lamp: liveLamp, strikeProgress: liveProgress, activeSlug } = useBooth.getState();
    const lamp = lampOverride ?? liveLamp;
    const strikeProgress = override ?? liveProgress;
    const P = lampById(lamp);
    const opening = useBooth.getState().opening;
    const curve = opening ? 'opening' : P.strike.curve;
    // C (08): only the first-visit opening strikes from dark. A lamp change is at full output from its
    // first frame (a strike from black read as a blink on every switch); FLOOD keeps its exposure
    // settle, which only ever brightens
    const ch = opening ? strikeChannels(curve, strikeProgress) : { ...strikeChannels(curve, 1), exposure: strikeChannels(curve, strikeProgress).exposure };
    const env = ch.light;
    const ramp = opening ? strikeKelvin(curve, strikeProgress) : null;
    const onTray = activeSlug !== null;

    scene.environmentIntensity = ENV_INTENSITY[lamp] * env;
    // C2 (09): the baked room lightmap in the lamp's colour (the diffuser's for the panel lamps, the key's
    // for A and FLOOD) at the lamp's bake level, struck with the rest of the rig (env = the opening's
    // light channel: the first visit's dark frame has no lightmap until the tubes strike)
    lightmapTint.value.setRGB(...(P.panel.intensity > 0 ? P.panel.colour : P.keyLight.colour)).multiplyScalar(P.bake * env);

    // ── ceiling panel + its visible diffuser ────────
    const pl = panel.current!;
    pl.intensity = P.panel.intensity * env;
    pl.color.setRGB(...P.panel.colour);
    pl.width = P.panel.w;
    pl.height = P.panel.d;
    pl.position.set(0, BOOTH.height - 0.006, P.panel.z);
    pl.rotation.set(-Math.PI / 2, 0, 0);
    // L3 (09B): the shelf is a 1.5m wall unit, not the 0.8m booth. Its ceiling panel becomes a softbox
    // above and in front of it, angled down at the boards, as wide as the unit
    const S = !onTray ? activeLayout().shelf : undefined;
    if (S) {
      pl.position.set(0, S.height + 0.18, S.frontZ + 0.62);
      pl.rotation.set(-0.95, 0, 0);
      pl.width = S.width + 0.3;
      pl.height = 0.7;
      pl.intensity *= 1.35;
    }
    // the diffuser glows only while its lamp is on; otherwise it only receives the scene's light (H)
    diffuserMaterial.emissive.setRGB(...P.panel.colour).multiplyScalar(P.diffuser * env);
    // ceiling: bounce from the floor + spill around the diffuser
    const bounce = (P.fill.intensity * 0.55 + P.diffuser * 0.1 + P.keyLight.intensity * 0.012) * env;
    ceilingMaterial.color.setRGB(0.45, 0.45, 0.44).multiply(tmpColour.setRGB(...P.fill.sky)).multiplyScalar(bounce);
    // the hood's glow is the same bounce: its old fixed level (sRGB #2a2a29) under D50, ~0 in the dark lamps
    hoodGlow.setRGB(...P.fill.sky).multiplyScalar((0.0232 * bounce) / D50_BOUNCE);

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
    // B1 (08): the shadow map (VSM: depth + blur, so its softness is baked into the map) re-renders
    // only while something moves a caster or the light: a lamp change or strike, a sample moving
    // (tray, turntable, the JSW clip), a resize or DPR step, a model arriving (lib/dirty.ts), or
    // the hand lamp moving. Otherwise the last map is reused.
    const { focusSlug } = useBooth.getState();
    const sk = shadowKey.current;
    if (override === undefined && (lamp !== sk.lamp || activeSlug !== sk.slug || focusSlug !== sk.focus || shadowEpoch.value !== sk.epoch)) {
      shadowKey.current = { lamp, slug: activeSlug, focus: focusSlug, epoch: shadowEpoch.value };
      markDirty(lamp !== sk.lamp ? 'lamp' : activeSlug !== sk.slug ? 'tray' : 'view', undefined, 3);
    }
    if (override === undefined && strikeProgress < 1) markDirty('strike', ['shadow', 'reflector'], 1);
    if (override === undefined && handWasMoving.current) markDirty('hand lamp', ['shadow', 'reflector'], 1);
    k.shadow.autoUpdate = false;
    const shadowsMatter = k.intensity > 0 && K.shadowIntensity > 0;
    if (override === undefined && takeDirty('shadow') && shadowsMatter) {
      k.shadow.needsUpdate = true;
      logEvent('shadow map re-render');
    }

    let handMoving = false;
    const handJustOn = lamp === 'AFTERDARK' && lastHandLamp.current !== 'AFTERDARK';
    lastHandLamp.current = lamp;
    if (lamp === 'AFTERDARK') {
      plane.constant = -(onTray ? TRAY.z : S ? S.frontZ : 0);
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
      if (S) k.position.set(h.pos.x * 0.35, h.pos.y + 0.55, S.frontZ + K.position[2]);
      else k.position.set(h.pos.x * 0.35, K.position[1], (onTray ? TRAY.z : 0) + K.position[2]);
      keyTarget.position.copy(h.pos);
      k.map = gobo;
    } else {
      // with a sample on the tray, every lamp keeps its geometry but aims at the tray
      const dz = onTray ? TRAY.z * 0.9 : 0;
      k.position.set(K.position[0], K.position[1], K.position[2] + dz);
      if (onTray) keyTarget.position.set(K.target[0] * 0.3, TRAY.top + 0.05, TRAY.z);
      else keyTarget.position.set(...K.target);
      if (S && K.intensity > 0) {
        // L3 (09B): the lamp's key keeps its side and character, stood back above the unit and aimed at
        // its middle; its level rises with the square of the longer throw (decay 2), so a board reads
        // as brightly lit as the booth floor does
        const cab = Math.hypot(K.position[0] - K.target[0], K.position[1] - K.target[1], K.position[2] - K.target[2]);
        k.position.set(K.position[0] * 1.6, S.height + 0.42, S.frontZ + 1.1);
        keyTarget.position.set(K.target[0] * 0.6, S.height * 0.44, S.frontZ - 0.12);
        const d = k.position.distanceTo(keyTarget.position);
        k.intensity *= (d * d) / Math.max(0.05, cab * cab);
        k.angle = Math.max(K.angle, 0.78);
      }
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
        // E (09): only SCREEN has the screens' own pools; under every other lamp the lights are out of
        // the scene (not at 0), so they cost nothing there
        s.light.visible = lamp === 'SCREEN';
        s.light.intensity = s.light.visible ? P.screens.spill * SCREEN_LIGHT_GAIN * ch.spill * keep : 0;
        s.light.color.copy(s.colour);
      }
      spillSum += keep;
      spillColour.add(s.colour);
    }
    if (spill.current) {
      // the screens' area together, from one light across the back row; out of the scene entirely
      // (not just at 0) when unlit, so it costs nothing under the other lamps
      spill.current.intensity = screens.size && !perScreenLights ? P.screens.spill * ch.spill * spillSum * SPILL_GAIN : 0;
      spill.current.visible = spill.current.intensity > 0;
      // L3 (09B): on the shelf the screens stand on several boards: the combined light spans the unit
      if (S) spill.current.position.set(0, S.height * 0.5, S.frontZ - 0.05), (spill.current.width = S.width), (spill.current.height = S.height * 0.7);
      else spill.current.position.set(0, 0.42, -0.2), (spill.current.width = 0.8), (spill.current.height = 0.16);
      spill.current.color.copy(screens.size ? spillColour.multiplyScalar(1 / screens.size) : spillColour);
    }

    // G: under SCREEN the screens face out of the booth, away from every object's front. What lights
    // the fronts in a real booth is their light coming back off the coved interior: a soft bounce,
    // the screens' average colour half desaturated, scaled by how much the screens are on.
    if (P.screens.bounce && screens.size) {
      tmpColour.setRGB(0, 0, 0);
      for (const sc of screens) tmpColour.add(sc.colour);
      tmpColour.multiplyScalar(1 / screens.size);
      const y = tmpColour.r * 0.2126 + tmpColour.g * 0.7152 + tmpColour.b * 0.0722;
      if (y > 1e-4) tmpColour.multiplyScalar(1 / y).lerp(tmpSpill.setRGB(1, 1, 1), 0.5);
      fr.color.copy(tmpColour);
      fr.intensity = P.screens.bounce * ch.spill * (spillSum / screens.size);
    }

    // ── proof-strip photos: the same lamp, as a print light model ──
    // Until the visitor picks a lamp themselves (a project's native lamp is set for them), the
    // photos stay D50-faithful: neutral white, true colour. After a pick they follow the lamp,
    // with readability floors under the dark lamps.
    const picked = useBooth.getState().lampPicked;
    const pr = picked || lamp === 'AFTERDARK' ? P.print : D50_PRINT;
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
      proofUniforms.uTorchLevel.value = Math.min(1, env);
      if (lamp === 'AFTERDARK') {
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
        // the page's torch overlay (C2) in viewport CSS px
        torch.x = printHand.pos.x / dpr;
        torch.y = (H - printHand.pos.y) / dpr;
        torch.r = r / dpr;
        torch.soft = pr.spot.soft;
        torch.outside = pr.spot.outside;
        torch.level = Math.min(1, env);
        torch.fromRig = true;
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
    postState.neutral = !P.dark;
    postState.matrix.fromArray(P.matrix).transpose(); // fromArray is column-major; presets are row-major
    if (useBooth.getState().lampPicked) proofUniforms.uNeutralize.value.identity();
    else proofUniforms.uNeutralize.value.copy(postState.matrix).invert();

    // Diagnostics (?lampdebug only: it reads pixels back): log the rig once each time a lamp settles.
    if (override === undefined && strikeProgress >= 1 && lastLamp.current !== lamp) {
      lastLamp.current = lamp;
      if (window.location.search.includes('lampdebug')) {
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
  };

  const precapture = useRef<Lamp | null>(null);
  useEffect(() => {
    if (MOBILE_TIER || perfOff('envcapture')) return;
    let id = 0;
    const idle = (cb: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 500));
    const next = () => {
      if (!revealed.value) {
        id = idle(next) as number;
        return;
      }
      const todo = LAMPS.map((l) => l.id).find((l) => !capturedEnvironment(l));
      if (!todo) return;
      precapture.current = todo;
      invalidate();
      id = idle(next) as number;
    };
    id = idle(next) as number;
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id);
  }, [invalidate]);

  useFrame((_, rawDt) => {
    // J2: the real interior is captured the first time a lamp is on screen: the rig is set at the
    // lamp's full output for the capture, then at the actual strike progress for the frame drawn,
    // so the environment is right from the lamp's first frame (no step once it has warmed up)
    const lamp = useBooth.getState().lamp;
    // L3 (09B): the environment is the booth's interior: captured in the cabinet only (the shelf uses
    // the cabinet's capture when there is one, the built interior otherwise)
    const cabinet = activeLayout().kind === 'cabinet';
    if (!MOBILE_TIER && !perfOff('envcapture') && cabinet && modelsSettled() && !capturedEnvironment(lamp)) {
      applyRig(0, 1);
      scene.environment = captureEnvironment(gl, scene, lamp);
      logEvent(`env capture ${lamp} (on screen)`);
    }
    // C4 (08): the other lamps are captured ahead, one per idle moment after the reveal, so a first
    // pick never captures mid-interaction (the rig is set to that lamp at full output for the capture,
    // then back to the visible lamp before this frame is drawn)
    const ahead = cabinet ? precapture.current : null;
    if (ahead) {
      precapture.current = null;
      if (!capturedEnvironment(ahead)) {
        const keep = scene.environment;
        applyRig(0, 1, ahead);
        captureEnvironment(gl, scene, ahead);
        // E (09): SCREEN brings its per-screen area lights into the scene: compile every material for
        // that light set now, while idle, so the visitor's first SCREEN switch never stalls on shaders
        if (ahead === 'SCREEN') {
          gl.compile(scene, camera);
          logEvent('SCREEN shaders pre-warmed (idle)');
        }
        scene.environment = keep;
        logEvent(`env capture ${ahead} (ahead, idle)`);
      }
    }
    applyRig(rawDt);
  });

  return (
    <>
      <rectAreaLight ref={panel} rotation={[-Math.PI / 2, 0, 0]} />
      <rectAreaLight ref={spill} width={0.8} height={0.16} position={[0, 0.42, -0.2]} rotation={[0, Math.PI, 0]} intensity={0} visible={false} />
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
