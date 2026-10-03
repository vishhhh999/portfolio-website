/**
 * Projected width of every sample in the lineup shot, as % of frame width,
 * from tools/camera.json (object footprint, plinth excluded). Fails under 5%.
 *   node tools/check-sizes.mjs
 */
import { readFileSync } from 'fs';
const cam = JSON.parse(readFileSync(new URL('./camera.json', import.meta.url)));
const tanV = Math.tan((cam.lens.fovVerticalDeg / 2) * Math.PI / 180);
let ok = true;
for (const [key, aspect] of [['LINEUP_16x10 (1440x900)', 1.6], ['LINEUP_16x9 (1920x1080)', 16 / 9]]) {
  const camZ = cam.shots[key].three.position[2];
  console.log(key);
  for (const p of cam.plinths) {
    const d = camZ - (p.three.center[2] + p.objectFootprint.d / 2);
    const pct = (p.objectFootprint.w / (2 * d * tanV * aspect)) * 100;
    if (pct < 5) ok = false;
    console.log(`  ${p.slug.padEnd(14)} ${pct.toFixed(1).padStart(5)}%${pct < 5 ? '  < 5% !' : ''}`);
  }
}
process.exit(ok ? 0 : 1);
