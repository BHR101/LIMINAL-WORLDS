// Captures genuine in-engine images: world-selection previews, README
// screenshots and GIF frames. Requires a running server (npm run dev).
// Usage: node scripts/capture.mjs [url]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const only = process.env.ONLY ?? '';
mkdirSync('public/previews', { recursive: true });
mkdirSync('docs/screenshots', { recursive: true });
mkdirSync('scripts/.out/gif', { recursive: true });

const previews = [
  ['sunken-cathedral', 0, 0.5],
  ['infinite-ascent', 0, 0.55],
  ['obsidian-city', 2, 0.55],
  ['impossible-house', 2, 0.5],
  ['last-horizon', 0, 0.55],
  ['random', 1, 0.5, 1234],
];
const screenshots = [
  ['cathedral-nave', 'sunken-cathedral', 0, 0.5],
  ['cathedral-colonnade', 'sunken-cathedral', 3, 0.55],
  ['cathedral-exterior', 'sunken-cathedral', 2, 0.6],
  ['ascent-tower', 'infinite-ascent', 3, 0.55],
  ['ascent-bridge', 'infinite-ascent', 0, 0.4],
  ['obsidian-ring', 'obsidian-city', 2, 0.55],
  ['obsidian-plaza', 'obsidian-city', 1, 0.5],
  ['house-exterior', 'impossible-house', 0, 0.5],
  ['house-nave', 'impossible-house', 2, 0.5],
  ['house-hallway', 'impossible-house', 1, 0.45],
  ['horizon-arches', 'last-horizon', 0, 0.55],
  ['horizon-platform', 'last-horizon', 2, 0.6],
  ['random-world', 'random', 0, 0.5, 777],
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => localStorage.setItem('liminal-worlds:settings:v1', JSON.stringify({ graphics: 'cinematic' })));
await page.goto(url);
await page.waitForFunction(() => window.liminal?.engine?.mode === 'menu', null, { timeout: 90000 });
const seek = (id, i, t, seed = 0) => page.evaluate(([id, i, t, seed]) => window.liminal.engine.debugCinematic(id, i, t, seed), [id, i, t, seed]);

if (!only || only === 'title') {
  await page.evaluate(() => window.liminal.engine.toTitle());
  await page.waitForTimeout(16000);
  await page.screenshot({ path: 'docs/screenshots/title.jpg', type: 'jpeg', quality: 85 });
  console.log('title');
}
if (!only || only === 'shots') {
  for (const [name, id, i, t, seed] of screenshots) {
    await seek(id, i, t, seed ?? 0);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `docs/screenshots/${name}.jpg`, type: 'jpeg', quality: 84 });
    console.log(name);
  }
}
if (!only || only === 'previews') {
  await page.setViewportSize({ width: 640, height: 360 });
  for (const [id, i, t, seed] of previews) {
    await seek(id, i, t, seed ?? 0);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `public/previews/${id}.jpg`, type: 'jpeg', quality: 78 });
    console.log('preview', id);
  }
}
if (!only || only === 'select') {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.liminal.engine.toTitle());
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'World Selection', exact: true }).first().click();
  // Software rendering starves CSS transitions; wait for the panel to settle.
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.screen.active .world-grid')?.closest('.screen') ?? document.body).opacity === '1', null, { timeout: 60000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'docs/screenshots/world-selection.jpg', type: 'jpeg', quality: 84 });
  console.log('select');
}
if (!only || only === 'gif') {
  await page.setViewportSize({ width: 560, height: 315 });
  const frames = 36;
  for (let f = 0; f < frames; f++) {
    await seek('sunken-cathedral', 0, 0.12 + (f / frames) * 0.7);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `scripts/.out/gif/f${String(f).padStart(3, '0')}.png` });
  }
  console.log('gif frames');
}
await browser.close();
