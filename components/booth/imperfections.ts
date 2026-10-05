'use client';

import { CanvasTexture, NoColorSpace, RepeatWrapping, type Texture } from 'three';

/**
 * J3: the small faults that make a surface read as a real one. Procedural, generated once (no
 * downloads), all subtle:
 *   smudgeMap   a roughness map for clear acrylic and glass: mostly polished (0.2 of the material's
 *               roughness), with a few fingerprints (whorls of fine ridges) and hairline scratches
 *               where it rises to full. Used as roughnessMap / clearcoatRoughnessMap (G channel).
 *   paperNormal a fibre normal map for matte paper: fine noise stretched along the grain.
 *   wallRoughness slow, wiped variation across a painted wall (±10% around the base).
 */
let s = 7331;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

let smudge: Texture | null = null;
export function smudgeMap(): Texture {
  if (smudge) return smudge;
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(51,51,51)';
  g.fillRect(0, 0, N, N);
  // fingerprints: whorls of thin ridges, soft at the edge
  for (let f = 0; f < 4; f++) {
    const cx = N * (0.15 + rnd() * 0.7), cy = N * (0.15 + rnd() * 0.7);
    const r0 = N * (0.05 + rnd() * 0.04), rot = rnd() * Math.PI;
    for (let k = 1; k < 16; k++) {
      const r = (r0 * k) / 15;
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.72, rot, rnd() * 0.6, Math.PI * 2 - rnd() * 0.6);
      g.strokeStyle = `rgba(210,210,210,${0.12 + 0.18 * (1 - k / 16)})`;
      g.lineWidth = 1.1;
      g.stroke();
    }
  }
  // hairline scratches
  for (let k = 0; k < 26; k++) {
    const x = rnd() * N, y = rnd() * N, a = rnd() * Math.PI, l = N * (0.03 + rnd() * 0.18);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.2) * l * 0.5, y + Math.sin(a + 0.2) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.strokeStyle = `rgba(255,255,255,${0.08 + rnd() * 0.2})`;
    g.lineWidth = 0.6;
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  return (smudge = t);
}

let fibre: Texture | null = null;
export function paperNormal(): Texture {
  if (fibre) return fibre;
  const N = 256;
  const h = new Float32Array(N * N);
  // fibres: short streaks along x at random heights, over a fine grain
  for (let i = 0; i < h.length; i++) h[i] = rnd() * 0.35;
  for (let k = 0; k < 1400; k++) {
    const x0 = Math.floor(rnd() * N), y = Math.floor(rnd() * N), len = 6 + Math.floor(rnd() * 22), v = 0.4 + rnd() * 0.6;
    for (let j = 0; j < len; j++) h[y * N + ((x0 + j) % N)] += v * Math.sin((j / len) * Math.PI);
  }
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const at = (x: number, y: number) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5, dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((dy / l * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  return (fibre = t);
}

let wall: Texture | null = null;
export function wallRoughness(): Texture {
  if (wall) return wall;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(232,232,232)';
  g.fillRect(0, 0, N, N);
  // soft wiped patches: a few large, faint, blurred blobs, slightly more or less matte
  g.filter = 'blur(18px)';
  for (let k = 0; k < 14; k++) {
    const v = Math.round(232 + (rnd() - 0.5) * 46);
    g.fillStyle = `rgba(${v},${v},${v},0.7)`;
    g.beginPath();
    g.ellipse(rnd() * N, rnd() * N, 20 + rnd() * 50, 10 + rnd() * 30, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = 'none';
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  return (wall = t);
}
