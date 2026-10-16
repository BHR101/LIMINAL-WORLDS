// Dev helper: render every cinematic shot of each world at t=0.5 for picking README/preview frames.
import { chromium } from 'playwright';
const worlds = (process.argv[2] ?? 'sunken-cathedral,infinite-ascent,obsidian-city,impossible-house,last-horizon').split(',');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.liminal?.engine?.mode === 'menu', null, { timeout: 60000 });
for (const id of worlds) {
  const n = await page.evaluate((id) => { window.liminal.engine.debugCinematic(id, 0, 0.5); return window.liminal.engine.world.cinematic.length; }, id);
  for (let i = 0; i < n; i++) {
    await page.evaluate(([id, i]) => window.liminal.engine.debugCinematic(id, i, Number(process?.env?.T ?? 0.55)), [id, i]).catch(async () => page.evaluate(([id, i]) => window.liminal.engine.debugCinematic(id, i, 0.55), [id, i]));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `scripts/.out/cand-${id}-${i}.png` });
  }
  console.log(id, n);
}
await browser.close();
