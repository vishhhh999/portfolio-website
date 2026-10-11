import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * Writes tools/camera.json from the live booth, so the Blender scene uses
 * exactly the numbers the site renders with (same code path, no copy).
 *   npm run build && npx next start -p 3100 &   then   node tools/export-camera.mjs
 */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright'); // npm i -D playwright, or point PLAYWRIGHT at an install
const BASE = process.env.BASE || 'http://localhost:3100';

const toBlender = ([x, y, z]) => [x, -z, y]; // three.js Y-up → Blender Z-up

const browser = await launch({ args: [] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__boothExport === 'function', null, { timeout: 20000 });
const data = await page.evaluate(() => ({ r16x9: window.__boothExport(16 / 9), r16x10: window.__boothExport(16 / 10) }));
await browser.close();

const shot = (s) => ({
  three: { position: s.position, target: s.target },
  blender: { location: toBlender(s.position), target: toBlender(s.target) },
});
const d = data.r16x9;
const out = {
  _readme:
    'Booth camera + staging for the Blender fallback renders. Units: metres. "three" = three.js world (Y-up, +Z towards camera). "blender" = same point in Blender (Z-up): (x, y, z)three -> (x, -z, y)blender. Run tools/blender_camera.py inside Blender to build both cameras, plinths, tray and props.',
  units: 'metres',
  lens: {
    fovVerticalDeg: d.fovVerticalDeg,
    sensorFit: 'VERTICAL',
    sensorHeightMm: d.sensorHeightMm,
    focalLengthMm: Number(d.focalLengthMm.toFixed(3)),
    clipStart: 0.1,
    clipEnd: 60,
    note: 'Vertical FOV is fixed; horizontal FOV follows the render aspect. The lineup shot distance is solved per aspect so the whole row fills the width, so it differs between 16:9 and 16:10.',
  },
  shots: {
    'LINEUP_16x9 (1920x1080)': shot(d.lineup),
    'LINEUP_16x10 (1440x900)': shot(data.r16x10.lineup),
    TRAY_16x9: Object.fromEntries(Object.entries(d.tray).map(([k, s]) => [k, shot(s)])),
  },
  booth: d.booth,
  trayPlate: { ...d.tray_plate, three: { center: [0, 0.002, d.tray_plate.z] }, blender: { center: toBlender([0, 0.002, d.tray_plate.z]) } },
  plinthChamferMetres: d.plinthChamfer,
  plinths: d.plinths.map((p) => ({
    slug: p.slug,
    size: { width_x: p.size.w, depth: p.size.d, height: p.size.h },
    three: { center: p.position, objectBase: p.objectBase },
    blender: { center: toBlender(p.position), objectBase: toBlender(p.objectBase) },
    objectFootprint: p.objectSize,
  })),
  props: d.props,
};
writeFileSync(new URL('./camera.json', import.meta.url), JSON.stringify(out, (_, v) => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 + 0 : v), 2) + '\n');
console.log('wrote tools/camera.json', out.lens);
