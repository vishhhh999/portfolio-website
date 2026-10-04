import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { lampById, type LampPreset } from '@/lib/lampPresets';
import type { Lamp } from '@/lib/types';
import { BOOTH, DIFFUSER } from './staging';

/**
 * Image-based light for the booth (D2): a small PMREM environment of the booth's own interior,
 * built from the lamp rig's own fixtures, so screens, foil, glossy card and bezels reflect the
 * real booth: the diffuser as a bright soft panel overhead (its tubes for TL84), the key light as
 * a hot spot where it hangs, N7 walls glowing with bounce, the room beyond the opening. One per
 * lamp, made on first use and cached. UV and AFTER DARK are near black.
 */
const cache = new Map<Lamp, WebGLRenderTarget>();
let pmrem: PMREMGenerator | null = null;

/** How strongly each lamp's environment lights the booth's materials (scene.environmentIntensity). */
export const ENV_INTENSITY: Record<Lamp, number> = { D50: 0.55, TL84: 0.5, A: 0.4, UV: 0.08, FLOOD: 0.35, SCREEN: 0.2, AFTERDARK: 0.03 };

function emissive(colour: Color) {
  return new MeshBasicMaterial({ color: colour, side: BackSide, toneMapped: false });
}

function buildScene(P: LampPreset) {
  const scene = new Scene();
  const W = BOOTH.width, H = BOOTH.height, D = BOOTH.frontZ - BOOTH.backZ;
  const cz = (BOOTH.frontZ + BOOTH.backZ) / 2;
  // the box: walls glow with the lamp's bounce (fill), the front opening shows the room
  const wall = new Color(...P.fill.sky).multiplyScalar(P.fill.intensity * 0.32 + P.panel.intensity * 0.06);
  const box = new Mesh(new BoxGeometry(W, H, D), [emissive(wall), emissive(wall), emissive(wall.clone().multiplyScalar(0.7)), emissive(wall.clone().multiplyScalar(0.8)), emissive(new Color(...P.room).multiplyScalar(2)), emissive(wall)]);
  box.position.set(0, H / 2, cz);
  scene.add(box);
  // the diffuser panel (or its tubes)
  if (P.panel.intensity > 0) {
    const level = new Color(...P.panel.colour).multiplyScalar(P.panel.intensity * 1.6);
    const tubes = P.id === 'TL84' ? 4 : 0;
    if (tubes) {
      for (let k = 0; k < tubes; k++) {
        const t = new Mesh(new PlaneGeometry(P.panel.w, 0.03), new MeshBasicMaterial({ color: level.clone().multiplyScalar(2.2), toneMapped: false }));
        t.rotation.x = Math.PI / 2;
        t.position.set(0, H - 0.005, P.panel.z - P.panel.d / 2 + ((k + 0.5) / tubes) * P.panel.d);
        scene.add(t);
      }
    } else {
      const d = new Mesh(new PlaneGeometry(P.panel.w, P.panel.d), new MeshBasicMaterial({ color: level, toneMapped: false }));
      d.rotation.x = Math.PI / 2;
      d.position.set(0, H - 0.005, DIFFUSER.z);
      scene.add(d);
    }
  }
  // the key light as a small hot source where it hangs
  // (the fluorescent lamps' key is part of the diffuser: glass reflects one broad soft panel)
  if (P.keyLight.intensity > 0 && (P.id === 'A' || P.id === 'FLOOD')) {
    const s = new Mesh(new SphereGeometry(P.id === 'A' ? 0.05 : 0.035, 16, 8), new MeshBasicMaterial({ color: new Color(...P.keyLight.colour).multiplyScalar(Math.min(40, P.keyLight.intensity * 2.4)), toneMapped: false }));
    s.position.set(...P.keyLight.position);
    scene.add(s);
  }
  // SCREEN: the devices' glow along the back tier
  if (P.id === 'SCREEN') {
    for (const [x, c] of [[-0.21, '#1457FF'], [0.22, '#4A3AFF'], [0.61, '#EF421B']] as const) {
      const q = new Mesh(new PlaneGeometry(0.22, 0.14), new MeshBasicMaterial({ color: new Color(c).multiplyScalar(1.4), toneMapped: false }));
      q.position.set(x, 0.38, -0.2);
      scene.add(q);
    }
  }
  return scene;
}

/** The environment map for a lamp (built once, then cached). */
export function boothEnvironment(gl: WebGLRenderer, lamp: Lamp): Texture {
  let rt = cache.get(lamp);
  if (!rt) {
    pmrem ??= new PMREMGenerator(gl);
    const scene = buildScene(lampById(lamp));
    rt = pmrem.fromScene(scene, 0.02, 0.05, 6, { size: 128, position: new Vector3(0, 0.3, 0.05) });
    scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      }
    });
    cache.set(lamp, rt);
  }
  return rt.texture;
}
