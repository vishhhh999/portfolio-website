/**
 * H5: @react-three/fiber (9.8.1, the latest) still builds its state clock with THREE.Clock, which
 * three r183+ deprecates (a console warning on every load). This postinstall step swaps it for a
 * Clock-compatible object driven by THREE.Timer. Idempotent; a no-op once R3F ships its own fix.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
const DIR = new URL('../node_modules/@react-three/fiber/dist/', import.meta.url).pathname;
const SHIM = `clock: /* patched by tools/patch-r3f-timer.mjs */ (() => {
        const timer = new THREE.Timer();
        return {
          autoStart: true, startTime: 0, oldTime: 0, elapsedTime: 0, running: false,
          start() { timer.reset(); this.startTime = this.oldTime = performance.now(); this.elapsedTime = 0; this.running = true; },
          stop() { this.getElapsedTime(); this.running = false; this.autoStart = false; },
          getElapsedTime() { this.getDelta(); return this.elapsedTime; },
          getDelta() {
            if (this.autoStart && !this.running) { this.start(); return 0; }
            if (!this.running) return 0;
            timer.update();
            const d = timer.getDelta();
            this.oldTime = performance.now();
            this.elapsedTime += d;
            return d;
          },
        };
      })(),`;
let n = 0;
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.js')) continue;
  const p = join(DIR, f);
  const s = readFileSync(p, 'utf8');
  if (!s.includes('clock: new THREE.Clock(),')) continue;
  writeFileSync(p, s.replace('clock: new THREE.Clock(),', SHIM));
  n++;
}
console.log(`patch-r3f-timer: ${n} file(s) patched`);
