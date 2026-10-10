import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT || 'playwright');

export const timeouts = Object.freeze({ soft: 300_000, gpu: 90_000 });

export function timeoutMs() {
  const fallback = timeouts[process.env.GL === 'gpu' ? 'gpu' : 'soft'];
  if (process.env.TIMEOUT_MS === undefined) return fallback;
  const value = Number(process.env.TIMEOUT_MS);
  if (!Number.isSafeInteger(value) || value < 1000) throw new Error('TIMEOUT_MS must be an integer of at least 1000 milliseconds');
  return value;
}

export async function waitForBoothSettled(page, label = 'booth capture readiness') {
  try {
    await page.waitForFunction(() => window.__boothSettled?.() === true, null, { timeout: timeoutMs() });
  } catch (error) {
    throw new Error(`Timed out waiting for ${label} after ${timeoutMs()} ms`, { cause: error });
  }
}

export async function settleAfterReady(page, softMs, label) {
  await waitForBoothSettled(page, label);
  await page.waitForTimeout(process.env.GL === 'gpu' ? 500 : softMs);
}

export async function launch(opts = {}) {
  const mode = process.env.GL || 'soft';
  if (mode !== 'soft' && mode !== 'gpu') throw new Error(`GL must be soft or gpu, got ${mode}`);
  const flags = mode === 'soft'
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=gl'])];
  let browser;
  try {
    browser = await playwright.chromium.launch({ ...opts, args: [...flags, ...(opts.args || [])] });
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs());
    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { renderer: 'WebGL unavailable', verified: false };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
        verified: !!debug,
      };
    });
    await page.close();
    console.log(`WebGL renderer: ${result.renderer}`);
    if (mode === 'gpu' && (!result.verified || /swiftshader/i.test(result.renderer) || result.renderer === 'WebGL unavailable')) {
      throw new Error(`GL=gpu requires a verified hardware renderer; found ${result.renderer}`);
    }
    return browser;
  } catch (error) {
    await browser?.close();
    if (mode === 'gpu') throw new Error(`GL=gpu refused: ${error.message}`, { cause: error });
    throw error;
  }
}
