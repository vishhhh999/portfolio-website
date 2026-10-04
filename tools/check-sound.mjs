/**
 * H: sound is off by default and downloads nothing; once on (a click), the AudioContext runs, a bed
 * plays for every lamp (level meter > 0) and crossfades on lamp change; S toggles it; the choice
 * persists (vm:sound:v1).   node tools/check-sound.mjs   (against a running build)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.setDefaultTimeout(600000);
const audio = [];
p.on('request', (r) => { if (/\.(wav|mp3|ogg|opus|m4a|webm|flac)(\?|$)/i.test(r.url()) || r.resourceType() === 'media') audio.push(r.url()); });
let ok = true;
const check = (label, pass, detail = '') => { if (!pass) ok = false; console.log(`${pass ? 'PASS' : 'FAIL'} ${label}${detail ? ': ' + detail : ''}`); };
await p.goto(BASE + '/', { waitUntil: 'networkidle' }); // the lamp panel (and its sound switch) exists only where there is a booth (B4)
check('sound off by default', (await p.textContent('.sound'))?.toLowerCase().includes('off'));
await p.waitForTimeout(1500);
check('no audio downloaded while off', audio.length === 0, audio.join(', '));
await p.evaluate(() => document.querySelector('.sound').click()); // a DOM click: SwiftShader keeps the main thread busy
await p.waitForTimeout(1200);
const level = async () => p.evaluate(() => Number(getComputedStyle(document.querySelector('.sound__meter')).getPropertyValue('--level')) || 0);
check('sound on after a click', (await p.textContent('.sound'))?.toLowerCase().includes('on'));
check('persisted', (await p.evaluate(() => localStorage.getItem('vm:sound:v1'))) === '1');
for (const [key, lamp] of [['1', 'D50'], ['2', 'TL84'], ['3', 'A'], ['4', 'UV'], ['5', 'FLOOD'], ['6', 'SCREEN'], ['7', 'AFTER DARK']]) {
  await p.keyboard.press(key);
  await p.waitForTimeout(1400);
  const l = await level();
  check(`bed playing under ${lamp}`, l > 0.05, `meter ${l.toFixed(2)}`);
}
await p.keyboard.press('s');
await p.waitForTimeout(800);
check('S turns it off', (await p.textContent('.sound'))?.toLowerCase().includes('off'));
check('still no audio files fetched', audio.length === 0, audio.join(', '));
await b.close();
process.exit(ok ? 0 : 1);
