// Dev helper: screenshot each world at given placements. node scripts/tour.mjs [filter]
import { chromium } from 'playwright';
const filter = process.argv[2] ?? '';
const shots = [
  ['cathedral-spawn', 'sunken-cathedral', {}],
  ['ascent-spawn', 'infinite-ascent', {}],
  ['obsidian-spawn', 'obsidian-city', { position: [0, 0, 70], yaw: 0, pitch: 0.12 }],
  ['house-spawn', 'impossible-house', {}],
  ['horizon-spawn', 'last-horizon', { position: [0, 0, -30], yaw: 0, pitch: 0.05 }],
  ['random-1', 'random', { seed: 1234 }],
].filter((s) => s[0].includes(filter));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.liminal?.engine?.mode === 'menu', null, { timeout: 60000 });
for (const [name, id, opts] of shots) {
  const t0 = Date.now();
  await page.evaluate(([id, opts]) => window.liminal.engine.debugPlace(id, opts), [id, opts]);
  await page.waitForTimeout(Number(process.env.WAIT ?? 3500));
  await page.screenshot({ path: `scripts/.out/${name}.png` });
  console.log(name, 'ok', Date.now() - t0, 'ms');
}
console.log(logs.join('\n'));
await browser.close();
