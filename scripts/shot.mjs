// Dev helper: load the app headlessly, run optional JS, screenshot. Usage:
// node scripts/shot.mjs <url> <out.png> [waitMs] [js]
import { chromium } from 'playwright';
const [url = 'http://localhost:5173/', out = 'scripts/.out/shot.png', wait = '6000', js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));
await page.goto(url);
await page.waitForTimeout(Number(wait));
if (js) {
  const r = await page.evaluate(js);
  if (r !== undefined) console.log('eval:', JSON.stringify(r));
  await page.waitForTimeout(Number(process.env.AFTER ?? 4000));
}
await page.screenshot({ path: out });
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
