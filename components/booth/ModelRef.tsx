'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { AnimationMixer, Box3, Color, FrontSide, MathUtils, PMREMGenerator, Scene, Vector3, type Mesh, type Object3D, type PerspectiveCamera } from 'three';
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
    loadModel(work.model.src, gl, 0).then((g) => {
      const r = g.scene.clone(true);
      // ?modelref=jsw-sports&open: the animated clip at its last frame (JSW: open at 110°, ref-open.png)
      if (work.model?.animation && new URLSearchParams(location.search).has('open')) {
        const clip = g.animations.find((c) => c.name === work.model!.animation) ?? g.animations[0];
        if (clip) {
          const mixer = new AnimationMixer(r);
          const action = mixer.clipAction(clip);
          action.play();
          action.paused = true;
          action.time = clip.duration;
          mixer.update(0);
        }
      }
      r.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && work.model?.frontSide) (m.material as { side: number }).side = FrontSide;
      });
      setRoot(r);
      invalidate();
      document.documentElement.dataset.modelref = 'ready';
    });
  }, [gl, work, invalidate]);

  // the reference world: flat 0.18 grey, lighting and reflected by every material as in Blender's
  // world shader (metals would otherwise reflect nothing and read black)
  useEffect(() => {
    const prevBg = scene.background, prevEnv = scene.environment;
    scene.background = new Color(0.18, 0.18, 0.18);
    const pm = new PMREMGenerator(gl);
    const world = new Scene();
    world.background = new Color(0.18, 0.18, 0.18);
    const env = pm.fromScene(world, 0, 0.1, 10, { size: 32 });
    scene.environment = env.texture;
    return () => {
      scene.background = prevBg;
      scene.environment = prevEnv;
      env.dispose();
      pm.dispose();
    };
  }, [scene, gl]);

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
