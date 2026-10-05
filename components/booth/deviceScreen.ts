'use client';

import { Box3, Mesh, MeshPhysicalMaterial, RectAreaLight, Vector3, type Object3D } from 'three';
import { getWork } from '@/content/work';
import { perfOff } from '@/lib/perfFlags';
import { screens, screenTexture } from './screens';
import { applyUV, type InkProjection } from './uvMaterial';
import { smudgeMap } from './imperfections';

/** A project's first still (a video's poster), for screens without logo files. */
const firstStill = (slug: string) => {
  const d = getWork(slug)?.deliverables[0];
  return d ? (d.type === 'video' ? d.poster ?? '' : d.src) : '';
};

/**
 * A device GLB's `screen` mesh (A3): the brand logo on its bg.txt colour, mapped by the mesh's UV0
 * (0–1 is the visible display, at the aspect its README states). The display is an emissive layer
 * under a glass coat; desktop adds an area light the size of the display, facing out of it, so the
 * screen lights the booth (SCREEN lamp). Returns a cleanup that unregisters it.
 */
export function attachScreen(root: Object3D, slug: string, aspect: number, mobile: boolean, ink?: InkProjection | null): () => void {
  const node = root.getObjectByName('screen');
  if (!node) return () => {};
  const tex = screenTexture(slug, aspect, firstStill(slug));
  const material = new MeshPhysicalMaterial({
    color: '#030304',
    roughness: 0.65,
    metalness: 0,
    emissive: '#ffffff',
    emissiveMap: tex.texture,
    emissiveIntensity: 0.5,
    clearcoat: 0.35,
    // J3: the glass's gloss carries a few fingerprints. F2 (08): the polished glass reads at
    // roughness ~0.12 (the map's 0.2 × 0.6), so the lamp spreads into a soft sheen, never a hot spot
    clearcoatRoughness: 0.6,
    clearcoatRoughnessMap: smudgeMap(),
    envMapIntensity: 0.35,
  });
  applyUV(material, { inkProj: ink ?? null });
  // F2 (08): no hot spot. The glass keeps its environment sheen (envMapIntensity, roughness ~0.12),
  // but the coat takes no direct specular from the lamps' small sources, which read as a white dot
  const uvCompile = material.onBeforeCompile;
  const uvKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    uvCompile.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\tclearcoatSpecularDirect = vec3( 0.0 );');
  };
  material.customProgramCacheKey = () => `${uvKey()}-screen-glass`;
  let mesh: Mesh | null = null;
  node.traverse((o) => {
    if ((o as Mesh).isMesh) {
      (o as Mesh).material = material;
      mesh ??= o as Mesh;
    }
  });
  let light: RectAreaLight | null = null;
  // B2 (08): one combined screen light for all devices (the rig's spill light), on desktop too;
  // `?perf&no=screencombine` restores 07's one area light per screen for an A/B
  if (mesh && !mobile && perfOff('screencombine') && !perfOff('screenlights')) {
    // the display's size and facing, from its own geometry (in the model's space)
    root.updateMatrixWorld(true);
    const m = mesh as Mesh;
    const geo = m.geometry;
    geo.computeBoundingBox();
    const local = geo.boundingBox!.getSize(new Vector3());
    const dims = [local.x, local.y, local.z].sort((a, b) => b - a);
    const n = new Vector3();
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) n.x += normals.getX(i), (n.y += normals.getY(i)), (n.z += normals.getZ(i));
    n.normalize().transformDirection(m.matrixWorld);
    const centre = new Box3().setFromObject(m).getCenter(new Vector3());
    // width runs along the light's local x (horizontal after lookAt): a portrait display is narrow
    light = aspect >= 1 ? new RectAreaLight('#ffffff', 0, dims[0], dims[1]) : new RectAreaLight('#ffffff', 0, dims[1], dims[0]);
    light.position.copy(centre).addScaledVector(n, 0.001);
    root.add(light);
    light.lookAt(centre.clone().addScaledVector(n, 1));
  }
  const entry = { material, light, colour: tex.colour };
  screens.add(entry);
  return () => {
    screens.delete(entry);
    light?.removeFromParent();
  };
}
