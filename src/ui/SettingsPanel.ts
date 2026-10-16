import type { Engine } from '../core/Engine';
import type { GraphicsPreset } from '../core/Settings';
import { el } from './dom';

/** Settings form bound directly to the persisted Settings store. */
export function buildSettings(engine: Engine): HTMLElement {
  const s = engine.settings;
  const d = s.data;
  const form = el('div', 'settings-form');
  form.innerHTML = `
    <label class="row"><span>Mouse sensitivity</span><input type="range" name="sensitivity" min="0.2" max="3" step="0.05" value="${d.sensitivity}"><output></output></label>
    <label class="row"><span>Field of view</span><input type="range" name="fov" min="50" max="100" step="1" value="${d.fov}"><output></output></label>
    <label class="row"><span>Master volume</span><input type="range" name="volume" min="0" max="1" step="0.01" value="${d.volume}"><output></output></label>
    <label class="row check"><span>Mute audio <kbd>M</kbd></span><input type="checkbox" name="muted" ${d.muted ? 'checked' : ''}></label>
    <label class="row"><span>Graphics quality</span>
      <select name="graphics">
        <option value="performance">Performance</option>
        <option value="balanced">Balanced</option>
        <option value="cinematic">Cinematic</option>
      </select></label>
    <p class="note">Reflections, particles and cloud detail update on the next world load.</p>
    <label class="row check"><span>Reduced motion</span><input type="checkbox" name="reducedMotion" ${d.reducedMotion ? 'checked' : ''}></label>
    <label class="row check"><span>Invert mouse Y</span><input type="checkbox" name="invertY" ${d.invertY ? 'checked' : ''}></label>
    <label class="row check"><span>Performance overlay <kbd>\`</kbd></span><input type="checkbox" name="showPerf" ${d.showPerf ? 'checked' : ''}></label>
    <label class="row"><span>Camera mode</span>
      <select name="camera">
        <option value="explore">First-person exploration</option>
        <option value="cinematic">Cinematic tour</option>
      </select></label>
    <div class="row"><span>Display</span><button type="button" class="btn small" data-act="fullscreen">Toggle fullscreen <kbd>F</kbd></button></div>
  `;
  const q = <T extends HTMLElement>(sel: string) => form.querySelector(sel) as T;
  (q<HTMLSelectElement>('select[name=graphics]')).value = d.graphics;
  const cameraSel = q<HTMLSelectElement>('select[name=camera]');
  const fmt: Record<string, (v: number) => string> = {
    sensitivity: (v) => `${v.toFixed(2)}×`,
    fov: (v) => `${v}°`,
    volume: (v) => `${Math.round(v * 100)}%`,
  };
  form.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((input) => {
    const out = input.parentElement!.querySelector('output')!;
    const name = input.name as 'sensitivity' | 'fov' | 'volume';
    const show = () => (out.textContent = fmt[name](Number(input.value)));
    show();
    input.addEventListener('input', () => {
      s.set(name, Number(input.value));
      show();
    });
  });
  form.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((input) => {
    input.addEventListener('change', () => s.set(input.name as 'muted' | 'reducedMotion' | 'invertY' | 'showPerf', input.checked));
  });
  q<HTMLSelectElement>('select[name=graphics]').addEventListener('change', (e) => s.set('graphics', (e.target as HTMLSelectElement).value as GraphicsPreset));
  cameraSel.addEventListener('change', () => {
    engine.preferCinematic = cameraSel.value === 'cinematic';
    if (engine.mode === 'paused' || engine.mode === 'playing') engine.toggleCinematic(engine.preferCinematic);
  });
  q<HTMLButtonElement>('[data-act=fullscreen]').addEventListener('click', () => engine.toggleFullscreen());
  // Keep the form in sync with keyboard shortcuts (M, `).
  s.onChange((data) => {
    q<HTMLInputElement>('input[name=muted]').checked = data.muted;
    q<HTMLInputElement>('input[name=showPerf]').checked = data.showPerf;
  });
  const sync = () => (cameraSel.value = engine.cinematicMode || engine.preferCinematic ? 'cinematic' : 'explore');
  form.addEventListener('focusin', sync);
  sync();
  (form as HTMLElement & { sync?: () => void }).sync = sync;
  return form;
}
