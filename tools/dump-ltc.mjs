/**
 * The RectAreaLight LTC lookup tables as a binary texture asset (public/booth/ltc.bin: two 64×64
 * RGBA float32 tables, 128 KB raw), so the booth's JS doesn't carry them as ~100 KB (gzipped) of
 * number literals. lib/ltc.ts loads it before the first frame.   node tools/dump-ltc.mjs
 */
import { writeFileSync } from 'fs';
import { RectAreaLightTexturesLib } from 'three/examples/jsm/lights/RectAreaLightTexturesLib.js';
RectAreaLightTexturesLib.init();
const a = RectAreaLightTexturesLib.LTC_FLOAT_1.image.data, b = RectAreaLightTexturesLib.LTC_FLOAT_2.image.data;
const out = new Float32Array(a.length + b.length);
out.set(a, 0);
out.set(b, a.length);
writeFileSync(new URL('../public/booth/ltc.bin', import.meta.url), Buffer.from(out.buffer));
console.log('ltc.bin', out.byteLength, 'bytes');
