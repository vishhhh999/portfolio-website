/**
 * Records GIFs of the booth at true speed on any machine (C9, J3). Software rendering can't keep
 * real time, so the page runs on Playwright's virtual clock (Date, performance.now, timers and
 * requestAnimationFrame): the clock advances in fixed steps and one frame is captured per step,
 * then ffmpeg assembles the GIF at the matching frame rate.
 *
 *   node tools/record-gif.mjs lamp <D50|TL84|...> [route] [seconds]   a lamp, 10s by default
 *   node tools/record-gif.mjs warmup <lamp>                          the strike, from the previous lamp
 *   node tools/record-gif.mjs transition <slug>                      booth → project → back
 *
 * Output: tools/lamp-review/gif/*.gif (1568 wide). Needs ffmpeg on PATH.
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = new URL('./lamp-review/gif/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const KEYS = { D50: '1', TL84: '2', A: '3', UV: '4', FLOOD: '5', SCREEN: '6', AFTERDARK: '7' };
const [mode = 'lamp', arg = 'D50', route = '/', secs = '10'] = process.argv.slice(2);

const W = 1568, H = 980;
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: W, height: H } });
const p = await ctx.newPage();
p.setDefaultTimeout(600000);

async function boot(path) {
  // let the page load and the booth settle in real time first, then freeze the clock
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: 600000 });
  await p.waitForTimeout(1500);
  await p.clock.install();
  await p.clock.pauseAt(Date.now() + 1000);
}

const frames = [];
const dir = `/tmp/gif-${process.pid}`;
mkdirSync(dir, { recursive: true });
async function capture(seconds, fps, clip) {
  const step = 1000 / fps;
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    await p.clock.runFor(step);
    const f = `${dir}/${String(frames.length).padStart(4, '0')}.png`;
    await p.screenshot({ path: f, clip });
    frames.push(f);
  }
}

let name = '';
const clip = { x: 0, y: 0, width: W, height: H };
if (mode === 'lamp') {
  await boot(route);
  if (arg !== 'D50') {
    await p.keyboard.press(KEYS[arg]);
    await p.clock.runFor(1200); // past the strike: a steady lamp
  }
  if (arg === 'AFTERDARK') await p.mouse.move(W * 0.45, H * 0.6);
  // a slow pointer drift, so parallax and the hand lamp show
  const n = Math.round(+secs * 8);
  for (let i = 0; i < n; i++) {
    await p.mouse.move(W * (0.35 + 0.3 * Math.sin((i / n) * Math.PI * 2)), H * (0.55 + 0.1 * Math.cos((i / n) * Math.PI * 2)));
    await capture(1 / 8, 8, clip);
  }
  name = `lamp-${arg}${route === '/' ? '' : '-' + route.split('/').pop()}`;
} else if (mode === 'warmup') {
  await boot(route);
  const from = arg === 'D50' ? 'TL84' : 'D50';
  if (from !== 'D50') {
    await p.keyboard.press(KEYS[from]);
    await p.clock.runFor(1200);
  }
  await capture(0.3, 20, clip);
  await p.keyboard.press(KEYS[arg]);
  await capture(1.5, 20, clip);
  name = `warmup-${arg}`;
} else if (mode === 'transition') {
  await boot('/');
  await capture(0.4, 15, clip);
  await p.evaluate((slug) => {
    // the same path as a click on the sample: the view-transition-wrapped navigation
    document.querySelector(`.booth-focus__item[data-slug="${slug}"]`)?.click();
  }, arg);
  await capture(2.2, 15, clip);
  await p.goBack();
  await capture(2, 15, clip);
  name = `transition-${arg}`;
}

const gif = `${OUT}${name}.gif`;
const fps = mode === 'lamp' ? 8 : mode === 'warmup' ? 20 : 15;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/%04d.png`, '-vf', `scale=784:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, gif]);
rmSync(dir, { recursive: true, force: true });
console.log(`${gif}: ${frames.length} frames at ${fps}fps`);
await b.close();
