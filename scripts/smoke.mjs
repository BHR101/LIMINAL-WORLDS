// End-to-end smoke test against a running server (npm run dev / preview).
// Usage: node scripts/smoke.mjs [url]   — uses Playwright + headless Chromium (SwiftShader).
import { chromium } from 'playwright';
import { statSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 640, height: 360 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

const E = (fn, arg) => page.evaluate(fn, arg);
const state = () =>
  E(() => {
    const e = window.liminal.engine;
    const p = e.player.position;
    return { mode: e.mode, world: e.worldDef?.id, x: p.x, y: p.y, z: p.z, roll: e.player.roll, cine: e.cinematicMode };
  });
const place = (id, opts) => E(([id, opts]) => window.liminal.engine.debugPlace(id, opts), [id, opts]);
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
const waitFor = (fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });

// Use the cheapest preset so software rendering keeps up.
await page.addInitScript(() => {
  if (!localStorage.getItem('liminal-worlds:settings:v1'))
    localStorage.setItem('liminal-worlds:settings:v1', JSON.stringify({ graphics: 'performance', sensitivity: 1 }));
});
await page.goto(url);
await waitFor(() => window.liminal?.engine?.mode === 'menu');
check('title screen loads', (await page.locator('.title-screen.active h1').count()) === 1);
check('tagline present', (await page.textContent('.tagline'))?.includes('Somewhere between geometry and memory.'));
for (const label of ['Enter the World', 'Explore a Random World', 'World Selection', 'Settings', 'Controls']) {
  check(`menu item "${label}"`, (await page.getByRole('button', { name: label, exact: true }).count()) >= 1);
}

// World selection panel lists all worlds with previews.
await page.getByRole('button', { name: 'World Selection', exact: true }).first().click();
await page.waitForTimeout(800);
check('world selection shows 9 cards', (await page.locator('.world-card').count()) === 9);
await page.locator('.world-card[data-id="infinite-ascent"]').click();
check('card selection state', (await page.locator('.world-card.selected').getAttribute('data-id')) === 'infinite-ascent');
await page.getByRole('button', { name: 'Back' }).first().click();

// Enter the default world via the real button and the glide transition.
await page.getByRole('button', { name: 'Enter the World', exact: true }).click();
await waitFor(() => window.liminal.engine.mode === 'playing', null, 90000);
let s = await state();
check('enter world → flying in the Infinite Regress', s.world === 'infinite-regress', JSON.stringify(s));
const p0 = [s.x, s.y, s.z];
await hold('w', 3000);
s = await state();
const moved = Math.hypot(s.x - p0[0], s.y - p0[1], s.z - p0[2]);
check('W flies forward', moved > 0.3, `moved ${moved.toFixed(2)}`);
check('flight stays clear of the fractal', await E(() => window.liminal.engine.world.flight.sdf(window.liminal.engine.player.position) > 0));
// Fly inward across the renormalisation boundary: the world must rescale seamlessly.
await E(() => {
  const e = window.liminal.engine;
  const dir = e.world.spawn.position.clone().normalize();
  e.player.position.copy(dir.multiplyScalar(30 / 3 + 0.4));
  e.player.velocity.set(0, 0, 0);
  e.player.yaw = e.world.spawn.yaw;
  e.player.pitch = e.world.spawn.pitch ?? 0;
});
await page.keyboard.down('w');
await waitFor(() => window.liminal.engine.player.position.length() > 20, null, 60000).catch(() => undefined);
await page.keyboard.up('w');
const rAfter = await E(() => window.liminal.engine.player.position.length());
check('inward flight renormalises (×3) instead of reaching the centre', rAfter > 20 && rAfter <= 30.5, `|p| = ${rAfter.toFixed(2)}`);
await place('sunken-cathedral', {});
await page.waitForTimeout(800);
await hold('w', 2000);
await hold('a', 2500);
s = await state();
check('corridor walls block movement', Math.abs(s.x) < 1.3, `x=${s.x.toFixed(2)}`);
check('feet stay on the corridor floor', Math.abs(s.y - 0.1) < 0.05, `y=${s.y.toFixed(3)}`);

// Pause and resume.
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
check('Escape pauses', (await state()).mode === 'paused');
await page.getByRole('button', { name: 'Resume', exact: true }).click();
await page.waitForTimeout(300);
check('Resume returns to play', (await state()).mode === 'playing');

// Mute toggle and settings persistence.
await page.keyboard.press('m');
const muted = await E(() => JSON.parse(localStorage.getItem('liminal-worlds:settings:v1')).muted);
check('M toggles mute and persists', muted === true);
await page.keyboard.press('m');

// Rendered portal: the chapel door leads to a hall 2.5 km away.
await place('sunken-cathedral', { position: [61.8, -0.4, -30], yaw: -Math.PI / 2 });
await page.waitForTimeout(600);
await page.keyboard.down('w');
await waitFor(() => window.liminal.engine.player.position.x > 2500, null, 60000).catch(() => undefined);
await page.keyboard.up('w');
s = await state();
check('chapel door portal → interior hall', s.x > 2500, `x=${s.x.toFixed(1)}`);

// The stair that returns.
await place('infinite-ascent', { position: [115, 15, 0], yaw: -Math.PI / 2 });
await page.waitForTimeout(600);
await page.keyboard.down('w');
await waitFor(() => window.liminal.engine.player.position.x < 90, null, 60000).catch(() => undefined);
await page.keyboard.up('w');
s = await state();
check('returning stair loops to its base', s.x < 90 && s.y < 1, `x=${s.x.toFixed(1)} y=${s.y.toFixed(2)}`);
check('discovery recorded (ascent-loop)', await E(() => window.liminal.engine.discoveries.isFound('ascent-loop')));

// Inverted district with a gravity roll.
await place('infinite-ascent', { position: [0, 12, -119.5], yaw: 0 });
await page.waitForTimeout(600);
await page.keyboard.down('w');
await waitFor(() => window.liminal.engine.player.position.z < -2000, null, 20000).catch(() => undefined);
s = await state();
await page.keyboard.up('w');
check('high arch → inverted district', s.z < -2000, `z=${s.z.toFixed(0)}`);
check('arrival begins rolled (gravity shift)', Math.abs(s.roll) > 0.3, `roll=${s.roll.toFixed(2)}`);

// Turned room (90° roll) in the house.
await place('impossible-house', { position: [8.6, 0, -1008], yaw: -Math.PI / 2 });
await page.waitForTimeout(600);
await page.keyboard.down('w');
await waitFor(() => window.liminal.engine.player.position.z < -1300, null, 20000).catch(() => undefined);
s = await state();
await page.keyboard.up('w');
check('turned-room portal crossing', s.z < -1300 && Math.abs(s.y) < 0.3, `z=${s.z.toFixed(0)} y=${s.y.toFixed(2)} roll=${s.roll.toFixed(2)}`);

// Window portal via E (auto-walk through a window-sized opening).
await place('impossible-house', { position: [-8.6, 0, -1008], yaw: Math.PI / 2 });
await page.waitForFunction(() => /window/i.test(document.querySelector('.hud-prompt')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => undefined);
const prompt = await page.textContent('.hud-prompt');
check('interaction prompt near the study window', /window/i.test(prompt ?? ''), prompt ?? '');
await page.keyboard.press('e');
await waitFor(() => window.liminal.engine.player.position.z < -3500, null, 20000).catch(() => undefined);
s = await state();
check('E through study window → vista', s.z < -3500, `z=${s.z.toFixed(0)}`);

// Cross-world portal via E.
await place('sunken-cathedral', { position: [-41.6, -0.1, 32], yaw: -Math.PI / 2 });
await page.waitForTimeout(800);
await page.keyboard.press('e');
await waitFor(() => window.liminal.engine.worldDef?.id === 'obsidian-city' && window.liminal.engine.mode === 'playing', null, 90000).catch(() => undefined);
s = await state();
check('hollow pillar → Obsidian City', s.world === 'obsidian-city', JSON.stringify(s));

// The Gallery: the stair that never tops out (translation portal) and the painting of itself.
await place('contradiction-gallery', {});
const sp = await E(() => {
  const p = window.liminal.engine.world.portals.find((x) => x.id === 'endless-stair').position;
  return [p.x - 1.6, p.y - 1.6, p.z];
});
await place('contradiction-gallery', { position: sp, yaw: -Math.PI / 2 });
await page.waitForTimeout(800);
await page.keyboard.down('w');
await waitFor((y0) => window.liminal.engine.player.position.y < y0 - 5, sp[1], 60000).catch(() => undefined);
await page.keyboard.up('w');
s = await state();
check('endless stair: climbing off the top lands on the bottom flight', s.y < sp[1] - 5, `y ${sp[1].toFixed(2)} → ${s.y.toFixed(2)}`);
await place('contradiction-gallery', { position: [0, 0, -36.5], yaw: 0 });
await page.waitForTimeout(800);
await page.keyboard.down('w');
await waitFor(() => window.liminal.engine.player.position.z > -25, null, 60000).catch(() => undefined);
await page.keyboard.up('w');
s = await state();
check('stepping into the recursive painting puts you back in front of it', s.z > -25, `z = ${s.z.toFixed(1)}`);
check('discovery recorded (gallery-droste)', await E(() => window.liminal.engine.discoveries.isFound('gallery-droste')));

// The Recursive Machine: pushing the 4D slice rewires the architecture.
await place('recursive-machine', {});
await page.waitForTimeout(800);
const w0 = await E(() => window.liminal.engine.world.root.getObjectByName('raymarch').material.uniforms.uW4.value);
await E(() => window.liminal.engine.player.position.set(13.5, 13.5, 16));
await page.waitForTimeout(500);
await page.keyboard.press('e');
await page.waitForTimeout(3000);
const w1 = await E(() => window.liminal.engine.world.root.getObjectByName('raymarch').material.uniforms.uW4.value);
check('machine slice advances along the fourth axis', w1 > w0, `w ${w0.toFixed(2)} → ${w1.toFixed(2)}`);
check('discovery recorded (machine-rewire)', await E(() => window.liminal.engine.discoveries.isFound('machine-rewire')));

// Fall recovery.
await place('infinite-ascent', {});
await page.waitForTimeout(1500);
await E(() => window.liminal.engine.player.position.set(0, 0, 160));
await waitFor(() => window.liminal.engine.player.position.z < 100 && window.liminal.engine.player.grounded, null, 40000).catch(() => undefined);
s = await state();
check('falling off the world recovers to safe ground', s.z < 100 && s.y > -1, `z=${s.z.toFixed(1)} y=${s.y.toFixed(1)}`);

// Cinematic mode.
await page.keyboard.press('g');
await page.waitForTimeout(500);
check('G enters cinematic mode', (await state()).cine === true);
await page.keyboard.press('g');
await waitFor(() => window.liminal.engine.mode === 'playing' && !window.liminal.engine.cinematicMode, null, 30000).catch(() => undefined);
check('G returns to first person', (await state()).cine === false);

// Photography mode and PNG export.
await page.keyboard.press('p');
await page.waitForTimeout(500);
check('P enters photo mode', (await state()).mode === 'photo');
const downloadP = page.waitForEvent('download', { timeout: 60000 }).catch((e) => e);
await page.getByRole('button', { name: /Capture PNG/ }).click();
const download = await downloadP;
const status = await page.textContent('.photo-status');
if (download instanceof Error) {
  check('screenshot exported as PNG', false, `no download event; status: ${status}`);
} else {
  const file = await download.path();
  const size = file ? statSync(file).size : 0;
  check('screenshot exported as PNG', download.suggestedFilename().endsWith('.png') && size > 10000, `${download.suggestedFilename()} ${size} bytes`);
}
check('photo status reports download', /Download started/.test(status ?? ''), status ?? '');
await page.keyboard.press('p');
await page.waitForTimeout(500);
check('P returns to exploration', (await state()).mode === 'playing');

// Random world from a seed is deterministic in name.
await place('random', { seed: 4242 });
const n1 = await E(() => window.liminal.engine.world.name);
await place('sunken-cathedral', {});
await place('random', { seed: 4242 });
const n2 = await E(() => window.liminal.engine.world.name);
check('random world reproducible from seed', n1 === n2, n1);

// Every world builds without errors.
for (const id of ['infinite-regress', 'contradiction-gallery', 'recursive-machine', 'sunken-cathedral', 'infinite-ascent', 'obsidian-city', 'impossible-house', 'last-horizon']) {
  await place(id, {});
  await page.waitForTimeout(1500);
  check(`world ${id} renders`, (await state()).world === id);
}

// Settings persist across reload.
await E(() => window.liminal.engine.settings.set('sensitivity', 1.75));
await page.reload();
await waitFor(() => window.liminal?.engine?.mode === 'menu');
const sens = await E(() => window.liminal.engine.settings.data.sensitivity);
check('settings persist across reload', sens === 1.75, String(sens));
const disc = await E(() => window.liminal.engine.discoveries.count);
check('discoveries persist across reload', disc >= 2, `${disc} found`);

check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
check('no failed requests', failed.length === 0, failed.slice(0, 5).join(' | '));
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
