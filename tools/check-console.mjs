/** Report browser errors and failed resources across the published routes. */
import { readdirSync } from 'node:fs';
import { launch, timeoutMs } from './lib/browser.mjs';

const base = process.env.BASE || 'http://localhost:3100';
const slugs = readdirSync(new URL('../content/work/', import.meta.url))
  .filter((file) => file.endsWith('.ts') && !['index.ts', '_placeholder.ts', 'corrections.ts', 'imported.ts'].includes(file)).map((file) => file.slice(0, -3));
const routes = ['/', '/about', '/archive', '/house-lights', ...slugs.map((slug) => '/work/' + slug)];
const allowlist = [];
const browser = await launch();
const failures = [];
try {
  for (const viewport of [{ width: 1568, height: 980 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600, reducedMotion: 'reduce' });
    for (const route of routes) {
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs());
      const errors = [];
      const onConsole = (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()); };
      const onResponse = (response) => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); };
      page.on('console', onConsole);
      page.on('response', onResponse);
      try {
        await page.goto(base + route, { waitUntil: 'networkidle', timeout: timeoutMs() });
        await page.waitForTimeout(500);
      } catch (error) { errors.push('navigation: ' + error.message); }
      page.off('console', onConsole);
      page.off('response', onResponse);
      await page.close();
      const unexpected = errors.filter((message) => !allowlist.some((allowed) => message.includes(allowed)));
      failures.push(...unexpected.map((message) => `${viewport.width} ${route}: ${message}`));
      console.log(`${unexpected.length ? 'FAIL' : 'PASS'} ${viewport.width} ${route}: ${unexpected.length} errors`);
    }
    await context.close();
  }
} finally { await browser.close(); }
for (const failure of failures) console.error(failure);
process.exit(failures.length ? 1 : 0);
