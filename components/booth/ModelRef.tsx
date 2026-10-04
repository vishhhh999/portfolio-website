'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { Box3, Color, FrontSide, MathUtils, Vector3, type Mesh, type Object3D, type PerspectiveCamera } from 'three';
import { getWork } from '@/content/work';
import { loadModel } from './models';

/**
 * ?modelref=<slug>: one GLB alone, set up like its Blender reference render (assets-src/models/
 * <slug>/<slug>.ref.png): a 50mm lens straight-on at the model's mid-height, a flat 0.18 grey
 * world, one soft key front-top-left, AgX. For tools/model-ref.mjs's side-by-side (D1).
 */
export function ModelRef({ slug }: { slug: string }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const [root, setRoot] = useState<Object3D | null>(null);
  const work = getWork(slug);

  useEffect(() => {
    if (!work?.model) return;
    loadModel(work.model.src, gl).then((g) => {
      const r = g.scene.clone(true);
      r.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && work.model?.frontSide) (m.material as { side: number }).side = FrontSide;
      });
      setRoot(r);
      invalidate();
      document.documentElement.dataset.modelref = 'ready';
    });
  }, [gl, work, invalidate]);

  // the reference world: flat 0.18 grey, no environment
  useEffect(() => {
    const prevBg = scene.background, prevEnv = scene.environment;
    scene.background = new Color(0.18, 0.18, 0.18);
    scene.environment = null;
    return () => {
      scene.background = prevBg;
      scene.environment = prevEnv;
    };
  }, [scene]);

  const fit = useMemo(() => {
    if (!root) return null;
    const b = new Box3().setFromObject(root);
    const c = b.getCenter(new Vector3()), s = b.getSize(new Vector3());
    return { c, s };
  }, [root]);

  useFrame(() => {
    if (!fit) return;
    // 50mm on a 24mm-high sensor; the object filling ~78% of the frame height, straight-on
    camera.fov = MathUtils.radToDeg(2 * Math.atan(12 / 50));
    camera.aspect = size.width / size.height;
    camera.clearViewOffset();
    const vt = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(fit.s.y / 0.78 / 2 / vt, fit.s.x / 0.78 / 2 / (vt * camera.aspect)) + fit.s.z / 2;
    camera.position.set(fit.c.x, fit.c.y, fit.c.z + dist);
    camera.lookAt(fit.c);
    camera.updateProjectionMatrix();
  }, 0);

  if (!root || !fit) return null;
  const key = new Vector3(-1, 1.2, 1.4).normalize().multiplyScalar(Math.max(fit.s.x, fit.s.y) * 3).add(fit.c);
  return (
    <>
      <primitive object={root} />
      <ambientLight intensity={0.35} />
      <rectAreaLight position={key.toArray()} width={fit.s.y * 1.5} height={fit.s.y * 1.5} intensity={6} onUpdate={(l) => l.lookAt(fit.c)} />
    </>
  );
}
