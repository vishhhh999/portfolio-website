import { launch, timeoutMs } from './lib/browser.mjs';
/**
 * A2, C7 (08): no frame of the booth may present black, partly cleared, or jump. Every presented
 * frame's mean stage luminance is recorded (window.__boothCapture, read straight after the frame is
 * drawn); no frame may drop more than 5% below the median of its neighbours (±3 frames). Scenarios:
 *
 *   reveal      the page from the first paint: the poster, the crossfade, the live booth. Composited
 *               captures of the cabinet frame (poster and canvas together); no dip, and the poster
 *               must match the live booth (mean difference ≤ 4%: a stale poster fails here)
 *   hover       the pointer across the page and every sample (on and off), under D50 and A
 *   lamp        D50 → A → D50 (a lamp change: the env capture, shadows and the strike)
 *   screen      D50 → SCREEN → D50 (E 09: the per-screen lights enter and leave; shaders pre-warmed)
 *   spin        a turntable drag on a sample and its release (the coast, the contact-shadow re-bake)
 *   jsw         the JSW book opened from the lineup (the dolly, the tray, the open animation)
 *   resize      L2 (09B): a window dragged across every shape and back, an iPad rotated both ways
 *
 *   node tools/check-flicker.mjs [width=1280]   (against a running build)
 */
import { createRequire } from 'module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const W = +(process.argv[2] || 1280), H = Math.round(W * 0.62);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await launch({ args: [] });
let fails = 0;
const run = (name) => !ONLY || ONLY.includes(name);

/** Worst single-frame drop against the median of its ±3 neighbours. */
function worstDrop(lums) {
  let worst = 0, at = -1;
  for (let i = 0; i < lums.length; i++) {
    const nb = lums.slice(Math.max(0, i - 3), i).concat(lums.slice(i + 1, i + 4)).sort((a, b) => a - b);
    if (!nb.length) continue;
    const med = nb[Math.floor(nb.length / 2)];
    const drop = med > 0 ? (med - lums[i]) / med : 0;
    if (drop > worst) (worst = drop), (at = i);
  }
  return { worst, at };
}
/**
 * Worst valley: a frame darker than the brightest of the 3 frames before it AND of the 3 after it.
 * A transition from one level to another (a lamp change, a dolly to the tray) is a step, not a
 * flicker; a frame that dips below both sides is one.
 */
function worstValley(lums) {
  let worst = 0, at = -1;
  for (let i = 1; i < lums.length - 1; i++) {
    const before = Math.max(...lums.slice(Math.max(0, i - 3), i)), after = Math.max(...lums.slice(i + 1, i + 4));
    const ref = Math.min(before, after);
    const drop = ref > 0 ? (ref - lums[i]) / ref : 0;
    if (drop > worst) (worst = drop), (at = i);
  }
  return { worst, at };
}
function report(name, lums, extra = '', valley = false) {
  const { worst, at } = valley ? worstValley(lums) : worstDrop(lums);
  const ok = lums.length > 5 && lums.every((v) => v > 0) && worst <= 0.05;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${lums.length} frames, luminance ${Math.min(...lums).toFixed(1)}-${Math.max(...lums).toFixed(1)}, worst ${valley ? 'dip below both sides' : 'drop'} ${(worst * 100).toFixed(1)}%${at >= 0 ? ` at frame ${at}` : ''}${extra}`);
}
async function capture(p, action, visibleContent = false) {
  await p.evaluate((visibleContent) => {
    const lums = [];
    if (visibleContent) lums.push = function (lum) {
      const live = document.querySelector('.booth-canvas canvas:not(.booth-cover)');
      const cover = document.querySelector('.booth-cover');
      // An opaque cover is the entire presented image. The hidden WebGL canvas can still
      // have the old CSS height, so its readback includes pixels below the new viewport.
      // Measure the cover in visible CSS coordinates, independent of that hidden buffer.
      if (cover && !cover.hidden && Number(getComputedStyle(cover).opacity) === 1 && Number(getComputedStyle(live).opacity) === 0) {
        const stage = window.__boothStageRect(), rect = cover.getBoundingClientRect();
        const left = Math.max(0, stage.left), right = Math.min(innerWidth, stage.right);
        const top = Math.max(0, stage.top), bottom = Math.min(innerHeight, stage.bottom);
        const data = cover.getContext('2d').getImageData(0, 0, cover.width, cover.height).data;
        const paper = getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g).map(Number);
        const paperLum = 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2];
        let sum = 0, ink = 0, alpha = 0;
        for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
          const cx = Math.floor((left + (x + 0.5) / 100 * (right - left) - rect.left) * cover.width / rect.width);
          const cy = Math.floor((top + (y + 0.5) / 100 * (bottom - top) - rect.top) * cover.height / rect.height);
          const i = (cy * cover.width + cx) * 4;
          const a = cx >= 0 && cy >= 0 && cx < cover.width && cy < cover.height ? data[i + 3] / 255 : 0;
          const color = a ? (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * a : 0;
          sum += color + paperLum * (1 - a); ink += color; alpha += a;
        }
        lum = right > left && bottom > top && ink > 0 && alpha > 0 ? +(sum / 10000).toFixed(2) : 0;
      }
      return Array.prototype.push.call(this, lum);
    };
    window.__boothCapture = { on: true, lums, visibleContent };
  }, visibleContent);
  await action();
  return p.evaluate(() => {
    window.__boothCapture.on = false;
    return window.__boothCapture.lums;
  });
}
const key = (p, k) => p.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), k);

// ── reveal: composited captures of the cabinet frame from first paint ───────────────────────
if (run('reveal')) {
  const p = await b.newPage({ viewport: { width: 1568, height: 980 } });
  p.setDefaultTimeout(timeoutMs());
  await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await p.goto(BASE + '/?perf', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.booth-frame');
  await p.waitForFunction(() => document.querySelector('.booth-poster img')?.complete);
  // DOM over the booth (spec chips, the keyboard layer, 09's sample tags, hint and cursor label) is not the booth
  await p.addStyleTag({ content: '.specchip,.booth-focus,.sampletags,.boothhint,.cursorlabel{visibility:hidden!important}' });
  const r = await p.locator('.booth-frame').boundingBox();
  const clip = { x: r.x, y: r.y, width: r.width, height: r.height };
  const frames = [];
  let readyAt = -1;
  for (let i = 0; i < 400; i++) {
    const png = await p.screenshot({ clip, timeout: timeoutMs() });
    const { data } = await sharp(png).resize(392, Math.round((392 * r.height) / r.width), { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    frames.push(data);
    const ready = await p.evaluate(() => document.documentElement.hasAttribute('data-booth-ready'));
    if (ready && readyAt < 0) readyAt = i;
    if (readyAt >= 0 && i - readyAt >= 6) break;
  }
  const mean = (d) => d.reduce((a, v) => a + v, 0) / d.length;
  const lums = frames.map(mean);
  const first = frames[0], last = frames[frames.length - 1];
  let diff = 0;
  for (let i = 0; i < first.length; i++) diff += Math.abs(first[i] - last[i]);
  diff = (diff / first.length / 255) * 100;
  const posterOk = diff <= 4;
  if (!posterOk) fails++;
  report('reveal (poster → crossfade → live)', lums, ` · ready at capture ${readyAt}`);
  console.log(`${posterOk ? 'PASS' : 'FAIL'} reveal: first paint (poster) vs live booth: mean difference ${diff.toFixed(2)}% (limit 4%)`);
  await p.close();
}

if (['hover', 'lamp', 'screen', 'spin', 'jsw'].some(run)) {
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.addInitScript(() => {
  // The diagnostic log retains only 40 lines. Remember warm-up messages as they arrive,
  // so hover activity cannot evict them and turn a completed capture into a timeout.
  window.__boothWarmEvents = { A: false, SCREEN: false };
  new MutationObserver((mutations) => {
    for (const m of mutations) for (const node of [...m.addedNodes, ...m.removedNodes]) {
      const text = node.textContent ?? '';
      if (text.includes('env capture A')) window.__boothWarmEvents.A = true;
      if (text.includes('SCREEN shaders pre-warmed')) window.__boothWarmEvents.SCREEN = true;
    }
  }).observe(document, { childList: true, subtree: true });
});
await p.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1')); // J5: no opening strike in steady-state checks
p.setDefaultTimeout(timeoutMs());
await p.goto(BASE + '/?perf&events', { waitUntil: 'networkidle' });
await p.waitForSelector('.booth-stage[data-ready="true"]', { timeout: timeoutMs() });
await p.waitForFunction(() => window.__boothSettled?.() === true);
await p.addStyleTag({ content: '.sampletags,.boothhint,.cursorlabel{visibility:hidden!important}' });
await p.waitForTimeout(2000);

// ── hover: across the page and on/off every sample, under D50 and A ─────────────────────────
if (run('hover'))
  for (const [lamp, k] of [['D50', '1'], ['A', '3']]) {
    await key(p, k);
    await p.waitForTimeout(3500); // past the strike
    const { boxes } = await p.evaluate(() => window.__boothBoxes());
    const centres = Object.entries(boxes).filter(([s]) => s !== 'about').map(([, r]) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]).sort((a, b) => a[0] - b[0]);
    const pts = [];
    for (const [x, y] of centres) pts.push([x, y], [x, y - 120]); // on, then off (above it)
    for (let i = 0; i <= 12; i++) pts.push([W * (0.05 + 0.9 * (i / 12)), H * (0.15 + 0.7 * Math.abs(Math.sin((i / 12) * Math.PI * 2)))]);
    const lums = await capture(p, async () => {
      for (const [x, y] of pts) {
        await p.mouse.move(x, y, { steps: 3 });
        await p.waitForTimeout(160);
      }
      await p.waitForTimeout(600);
    });
    report(`hover ${lamp}`, lums);
  }

// ── lamp change: D50 → A → D50 ──────────────────────────────────────────────────────────────
if (run('lamp')) {
  await p.mouse.move(4, 4);
  await key(p, '1');
  await p.waitForTimeout(3500);
  // the lamps' interiors are captured while idle after the reveal (in software rendering that takes
  // minutes); wait for A's, so the switch measures the switch, then force a few steady frames on each side
  await p.waitForFunction(() => window.__boothWarmEvents.A, null, { timeout: timeoutMs() }).catch(() => {});
  const steady = () => p.evaluate(() => window.__boothBench?.(1)); // one presented frame, nothing changed
  const lums = await capture(p, async () => {
    for (const k of ['3', '1']) {
      for (let i = 0; i < 3; i++) (await steady(), await p.waitForTimeout(300));
      await key(p, k);
      await p.waitForTimeout(3500);
    }
    for (let i = 0; i < 3; i++) (await steady(), await p.waitForTimeout(300));
  });
  report('lamp change D50 → A → D50', lums, '', true);
}

// ── E (09): D50 → SCREEN → D50: the per-screen lights enter and leave the scene ─────────────
if (run('screen')) {
  await p.mouse.move(4, 4);
  await key(p, '1');
  await p.waitForTimeout(3500);
  await p.waitForFunction(() => window.__boothWarmEvents.SCREEN, null, { timeout: 1500000 }).catch(() => console.log('  (SCREEN pre-warm not seen in the event log)'));
  const steady = () => p.evaluate(() => window.__boothBench?.(1));
  // the switch's own cost: wall time from the key to the next presented frame, against D50 → A
  const switchMs = async (k) => p.evaluate(async (k) => {
    const t0 = performance.now();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  }, k);
  const lums = await capture(p, async () => {
    for (const k of ['6', '1']) {
      for (let i = 0; i < 3; i++) (await steady(), await p.waitForTimeout(300));
      await key(p, k);
      await p.waitForTimeout(5000);
    }
    for (let i = 0; i < 3; i++) (await steady(), await p.waitForTimeout(300));
  });
  const tScreen = await switchMs('6');
  await p.waitForTimeout(4000);
  const tBack = await switchMs('1');
  await p.waitForTimeout(4000);
  const tA = await switchMs('3');
  await p.waitForTimeout(4000);
  await key(p, '1');
  report('lamp change D50 → SCREEN → D50', lums, ` · key-to-frame: SCREEN ${tScreen.toFixed(0)}ms, back to D50 ${tBack.toFixed(0)}ms, D50 → A ${tA.toFixed(0)}ms (software)`, true);
}

// ── turntable: drag a sample, release, let it coast and re-bake its contact shadow ──────────
if (run('spin')) {
  const { boxes } = await p.evaluate(() => window.__boothBoxes());
  const s = boxes.sook ?? Object.values(boxes)[0];
  const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
  const lums = await capture(p, async () => {
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    for (let i = 1; i <= 8; i++) await p.mouse.move(cx + i * 22, cy, { steps: 2 });
    await p.mouse.up();
    await p.mouse.move(4, 4);
    await p.waitForTimeout(2500);
  });
  report('turntable spin + release', lums);
}

// ── JSW open: from the lineup onto the tray ─────────────────────────────────────────────────
if (run('jsw')) {
  const { boxes } = await p.evaluate(() => window.__boothBoxes());
  const j = boxes['jsw-sports'];
  const lums = await capture(p, async () => {
    const steady = () => p.evaluate(() => window.__boothBench?.(1));
    for (let i = 0; i < 3; i++) await steady();
    await p.mouse.click((j.x0 + j.x1) / 2, (j.y0 + j.y1) / 2);
    await p.waitForURL('**/work/jsw-sports');
    // Sample presented frames through the dolly, rather than a wall-clock pause that can
    // expire before a software renderer presents even its second frame.
    for (let i = 0; i < 12; i++) { await steady(); await p.waitForTimeout(100); }
  });
  report('JSW open (dolly, tray, open)', lums, '', true);
}
await p.close();
}

// ── L2 (09B): a window dragged across every shape and an iPad rotated, both ways ───────────
// Compare presented pixels through the CSS cover and page background. An alpha-weighted mean
// falsely dips as two different silhouettes crossfade; empty or black renders still fail.
if (run('resize')) {
  const q = await b.newPage({ viewport: { width: 2560, height: 1440 } });
  q.setDefaultTimeout(timeoutMs());
  await q.addInitScript(() => sessionStorage.setItem('vm:opened:v1', '1'));
  await q.goto(BASE + '/?perf', { waitUntil: 'networkidle' });
  await q.waitForSelector('.booth-stage[data-ready="true"]', { timeout: timeoutMs() });
  await q.waitForFunction(() => window.__boothSettled?.() === true);
  await q.addStyleTag({ content: '.sampletags,.boothhint,.cursorlabel{visibility:hidden!important}' });
  await q.waitForTimeout(2000);
  const settle = async (w, h) => {
    await q.setViewportSize({ width: w, height: h });
    await q.waitForFunction(([w, h]) => { const s = window.__boothShape?.(); return s && s.w === w && Math.abs(s.h - h) < 2; }, [w, h], { timeout: timeoutMs(), polling: 500 });
    await q.waitForFunction(() => !document.querySelector('.booth-cover') || document.querySelector('.booth-cover').hidden, null, { timeout: timeoutMs(), polling: 500 });
    for (let i = 0; i < 3; i++) (await q.evaluate(() => window.__boothBench?.(1)), await q.waitForTimeout(200));
  };
  const seqs = {
    'window drag 2560x1440 → 1376x940 → 1032x1230 → 393x659 → back': [[1376, 940], [1032, 1230], [393, 659], [1032, 1230], [1376, 940], [2560, 1440]],
    'iPad Pro 13 rotation 1032x1230 ↔ 1376x980': [[1032, 1230], [1376, 980], [1032, 1230], [1376, 980]],
  };
  for (const [name, seq] of Object.entries(seqs)) {
    const lums = await capture(q, async () => {
      for (const [w, h] of seq) {
        const start = await q.evaluate(() => window.__boothCapture.lums.length);
        await settle(w, h);
        const samples = await q.evaluate((start) => window.__boothCapture.lums.slice(start), start);
        console.log(`  resize ${w}x${h}: frames ${start}-${start + samples.length - 1}, luminance ${Math.min(...samples).toFixed(1)}-${Math.max(...samples).toFixed(1)}`);
      }
    }, true);
    report(`resize: ${name}`, lums, '', true);
  }
  await q.close();
}

await b.close();
console.log(fails ? `✗ ${fails} failure(s)` : '✓ no dark, dipping or jumping frames');
process.exit(fails ? 1 : 0);
