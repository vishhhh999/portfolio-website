'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, ConeGeometry, DataTexture, HemisphereLight, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PMREMGenerator,
  MathUtils, Scene, ShaderMaterial, SpotLight, Vector2, Vector3, type Texture,
} from 'three';
import { useBooth } from '@/lib/store';
import { lampById, strikeChannels, strikeKelvin, type LampPreset } from '@/lib/lampPresets';
import { kelvinToAdapted } from '@/lib/kelvin';
import { perfInfo } from '@/lib/perfTier';
import { torch } from '@/lib/torch';
import { kick, setContinuous } from './activity';
import type { Layout } from './composition';
import { shared, screens } from './materials';
import { diffuserMaterial } from './Room';
import { screenAnchors } from './registry';
import type { Lamp } from '@/lib/types';

/** Reflection environment per lamp: its light panels in a black void, prefiltered once and cached. */
const envCache = new Map<Lamp, Texture>();
function envFor(gl: import('three').WebGLRenderer, lamp: LampPreset): Texture {
  const hit = envCache.get(lamp.id);
  if (hit) return hit;
  const scene = new Scene();
  scene.background = new Color(0.004, 0.004, 0.004);
  for (const f of lamp.env.formers) {
    const m = new Mesh(new PlaneGeometry(f.size[0], f.size[1]), new MeshBasicMaterial({ color: new Color(...f.colour).multiplyScalar(f.intensity), side: DoubleSide }));
    m.position.set(...f.pos);
    m.lookAt(0, 0.2, 0);
    scene.add(m);
  }
  const pmrem = new PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.02, 0.05, 20);
  pmrem.dispose();
  envCache.set(lamp.id, rt.texture);
  return rt.texture;
}

const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;

/** The hand lamp's cookie: a soft disc with a slightly brighter rim and a faint ring, like a real torch. */
function torchCookie() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.62, '#f2f2f2');
  grad.addColorStop(0.72, '#ffffff');
  grad.addColorStop(0.86, '#555');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c) as Texture;
}

/**
 * All seven lamps on one fixed set of lights (so a lamp change never recompiles anything):
 *   key      one spot light with soft PCF shadows: a diffuser, a tube bank, a tungsten lamp, a flood, a torch
 *   fill     hemisphere bounce
 *   spills   three unshadowed spots at the device screens (SCREEN)
 *   env      the lamp's reflection environment
 * plus the diffuser panel's glow, the screens' emission, the UV fluorescence and FLOOD's haze.
 */
export function Rig({ layout }: { layout: Layout }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const lampId = useBooth((s) => s.lamp);
  const lamp = lampById(lampId);
  const key = useMemo(() => {
    const l = new SpotLight('#ffffff', 0, 0, 0.7, 1, 2);
    l.castShadow = true;
    const n = perfInfo().shadowMap;
    l.shadow.mapSize.set(n, n);
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.004;
    l.shadow.blurSamples = 12;
    l.shadow.camera.near = 0.3;
    l.shadow.camera.far = 6;
    l.shadow.camera.layers.enableAll();
    l.map = white;
    return l;
  }, []);
  const target = useMemo(() => new Object3D(), []);
  const fill = useMemo(() => new HemisphereLight('#ffffff', '#555555', 0), []);
  const spills = useMemo(() => [0, 1, 2].map(() => {
    const s = new SpotLight('#ffffff', 0, 1.6, 1.1, 1, 2);
    s.castShadow = false;
    return s;
  }), []);
  const spillTargets = useMemo(() => spills.map(() => new Object3D()), [spills]);
  // the tray's own light: a soft spot from above the opening, up on a project page, off at home
  const trayLight = useMemo(() => new SpotLight('#ffffff', 0, 3, 0.32, 0.9, 2), []);
  const trayTarget = useMemo(() => new Object3D(), []);
  const trayLevel = useRef(0);
  const cookie = useMemo(() => (typeof document !== 'undefined' ? torchCookie() : white), []);

  // the haze cone: an additive beam from the flood to the floor
  const haze = useMemo(() => {
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: { uLevel: { value: 0 }, uColour: { value: new Color(1, 1, 1) } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uLevel; uniform vec3 uColour; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = uLevel * edge * (0.05 + 0.12 * vY); gl_FragColor = vec4(uColour * a, a); }',
    });
    const mesh = new Mesh(new ConeGeometry(1, 1, 48, 1, true), m);
    mesh.visible = false;
    mesh.renderOrder = 5;
    return mesh;
  }, []);

  // room-relative placement: the presets are written for the wide booth
  const sx = layout.room.w / 1.8, sy = layout.room.h / 0.66, sz = layout.room.d / 1.04;
  const place = (v: [number, number, number], out: Vector3) => out.set(v[0] * sx, v[1] * sy, v[2] * sz);

  useEffect(() => {
    scene.add(key, target, fill, haze, trayLight, trayTarget, ...spills, ...spillTargets);
    key.target = target;
    trayLight.target = trayTarget;
    spills.forEach((s, i) => (s.target = spillTargets[i]));
    return () => void scene.remove(key, target, fill, haze, trayLight, trayTarget, ...spills, ...spillTargets);
  }, [scene, key, target, fill, haze, spills, spillTargets, trayLight, trayTarget]);

  useEffect(() => {
    scene.environment = envFor(gl, lamp);
    gl.toneMappingExposure = lamp.exposure;
    key.map = lamp.id === 'AFTERDARK' ? cookie : white;
    setContinuous(lamp.continuous);
    kick(Math.max(400, lamp.strike.duration * 1000 + 100));
    document.documentElement.dataset.lamp = lamp.id;
  }, [lamp, gl, scene, key, cookie]);

  const c = useMemo(() => new Color(), []);
  const pointer = useRef(new Vector2(0, 0.1));
  const aim = useRef(new Vector3(0, 0.2, 0));
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      torch.x = e.clientX;
      torch.y = e.clientY;
      torch.fromRig = true;
      const r = gl.domElement.getBoundingClientRect();
      pointer.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (useBooth.getState().lamp === 'AFTERDARK') kick(600);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl]);

  const tmp = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const { strikeProgress } = useBooth.getState();
    const ch = strikeChannels(lamp.strike.curve, strikeProgress);
    if (strikeProgress < 1) kick(32);
    const k3 = lamp.key3;
    const kelvin = strikeKelvin(lamp.strike.curve, strikeProgress);
    c.setRGB(...(kelvin ? kelvinToAdapted(kelvin) : k3.colour));
    key.color.copy(c);
    key.intensity = k3.intensity * ch.light;
    key.angle = k3.angle;
    key.penumbra = k3.penumbra;
    key.shadow.radius = k3.radius;
    key.shadow.intensity = k3.shadow;
    if (lamp.id === 'AFTERDARK') {
      // the hand lamp: aimed where the pointer is over the booth, following with a little lag
      tmp.set(pointer.current.x, pointer.current.y, 0.5).unproject(camera).sub(camera.position).normalize();
      const t = (layout.tray.z * 0.3 - camera.position.z) / tmp.z;
      const hit = camera.position.clone().addScaledVector(tmp, t);
      hit.y = Math.max(0.05, Math.min(layout.room.h * 0.8, hit.y));
      hit.x = Math.max(-layout.room.w / 2, Math.min(layout.room.w / 2, hit.x));
      aim.current.lerp(hit, 1 - Math.exp(-dt * 9));
      if (aim.current.distanceTo(hit) > 0.001) kick(32);
      key.position.set(aim.current.x * 0.25, layout.room.h * 0.8, layout.room.d / 2 + 1.3);
      target.position.copy(aim.current);
    } else {
      place(k3.pos, key.position);
      place(k3.target, target.position);
    }
    target.updateMatrixWorld();
    fill.color.setRGB(...lamp.fill.sky);
    fill.groundColor.setRGB(...lamp.fill.ground);
    fill.intensity = lamp.fill.intensity * ch.light;
    scene.environmentIntensity = lamp.env.intensity * Math.max(0.15, ch.light);
    diffuserMaterial.emissive.setRGB(...lamp.diffuserColour);
    diffuserMaterial.emissiveIntensity = lamp.diffuser * ch.light;
    gl.toneMappingExposure = lamp.exposure * ch.exposure;
    shared.uUV.value = lamp.uv * ch.uv;
    for (const s of screens.values()) s.material.emissiveIntensity = lamp.screens.gain * ch.screens;
    // SCREEN: each display throws its own colour onto the booth
    let i = 0;
    for (const [, a] of screenAnchors) {
      if (i >= spills.length) break;
      const s = spills[i];
      a.at.updateWorldMatrix(true, false);
      a.at.getWorldPosition(s.position);
      const fwd = tmp.set(0, 0, 1).transformDirection(a.at.matrixWorld);
      s.position.addScaledVector(fwd, 0.02);
      spillTargets[i].position.copy(s.position).addScaledVector(fwd, 0.5).add({ x: 0, y: -0.25, z: 0 } as Vector3);
      spillTargets[i].updateMatrixWorld();
      s.color.setRGB(a.colour.r, a.colour.g, a.colour.b);
      s.intensity = lamp.screens.spill * ch.spill * 2.2;
      i++;
    }
    // FLOOD's beam: a cone from the lamp to the floor
    const hz = lamp.haze * ch.light;
    haze.visible = hz > 0.001;
    if (haze.visible) {
      const top = key.position, bottom = target.position;
      const len = top.distanceTo(bottom);
      haze.position.copy(top).lerp(bottom, 0.5);
      haze.scale.set(Math.tan(key.angle) * len, len, Math.tan(key.angle) * len);
      haze.lookAt(top);
      haze.rotateX(Math.PI / 2);
      (haze.material as ShaderMaterial).uniforms.uLevel.value = hz;
      (haze.material as ShaderMaterial).uniforms.uColour.value.copy(c);
    }
    // the tray light follows the key's colour; it stays off in the dark lamps (they have their own story)
    const wantTray = useBooth.getState().activeSlug && !lamp.dark ? 1 : 0;
    trayLevel.current = MathUtils.damp(trayLevel.current, wantTray, 6, dt);
    if (Math.abs(trayLevel.current - wantTray) > 0.003) kick(32);
    trayLight.color.copy(c);
    trayLight.intensity = trayLevel.current * k3.intensity * 0.45 * ch.light;
    trayLight.position.set(layout.tray.x + 0.25 * sx, layout.room.h * 1.6, layout.tray.z + 0.9 * sz);
    trayTarget.position.set(layout.tray.x, 0.1, layout.tray.z);
    trayTarget.updateMatrixWorld();
    torch.level = lamp.id === 'AFTERDARK' ? ch.light : 1;
  });
  return null;
}
