import type { Engine } from '../core/Engine';
import type { CaptureResult } from '../systems/ScreenshotSystem';
import { el, escapeHtml } from './dom';

/** Photography panel: lens, exposure, depth of field, lighting, orbit, capture, gallery. */
export class PhotoPanel {
  readonly root = el('aside', 'photo-panel hidden');
  private status = el('p', 'photo-status');
  private gallery = el('div', 'photo-gallery');
  private hiddenUI = false;

  constructor(private engine: Engine) {
    this.root.setAttribute('aria-label', 'Photography mode');
    this.root.innerHTML = `
      <header><h2>Photography</h2><p>Drag to look · WASD move · Space / C rise &amp; fall · Shift faster</p></header>
      <label class="row"><span>Field of view</span><input type="range" name="fov" min="15" max="110" step="1"><output></output></label>
      <label class="row"><span>Exposure</span><input type="range" name="exposure" min="-2" max="2" step="0.05" value="0"><output></output></label>
      <label class="row"><span>Depth of field</span><input type="range" name="aperture" min="0" max="10" step="0.1" value="0"><output></output></label>
      <label class="row"><span>Focus distance</span><input type="range" name="focus" min="0.5" max="150" step="0.5" value="10"><output></output></label>
      <label class="row"><span>Lighting</span>
        <select name="lighting">
          <option value="natural">Natural</option>
          <option value="golden">Golden</option>
          <option value="blue">Blue hour</option>
          <option value="noir">Monochrome</option>
        </select></label>
      <label class="row check"><span>Orbit around focus point</span><input type="checkbox" name="orbit"></label>
      <label class="row check"><span>Freeze time</span><input type="checkbox" name="freeze" checked></label>
      <div class="photo-actions">
        <button type="button" class="btn primary" data-act="capture">Capture PNG <kbd>Enter</kbd></button>
        <button type="button" class="btn" data-act="hide">Hide interface <kbd>H</kbd></button>
        <button type="button" class="btn" data-act="exit">Return <kbd>P</kbd></button>
      </div>
    `;
    this.root.append(this.status, this.gallery);
    const ph = engine.photo;
    const fmt: Record<string, (v: number) => string> = {
      fov: (v) => `${v.toFixed(0)}°`,
      exposure: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} EV`,
      aperture: (v) => (v === 0 ? 'off' : v.toFixed(1)),
      focus: (v) => `${v.toFixed(1)} m`,
    };
    this.root.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((input) => {
      const out = input.parentElement!.querySelector('output')!;
      const name = input.name as 'fov' | 'exposure' | 'aperture' | 'focus';
      const update = () => {
        ph[name] = Number(input.value);
        out.textContent = fmt[name](ph[name]);
        engine.applyPhotoCamera();
      };
      input.addEventListener('input', update);
      (input as HTMLInputElement & { refresh?: () => void }).refresh = () => {
        input.value = String(ph[name]);
        out.textContent = fmt[name](ph[name]);
      };
    });
    this.q<HTMLSelectElement>('select[name=lighting]').addEventListener('change', (e) =>
      engine.setPhotoLighting((e.target as HTMLSelectElement).value as 'natural' | 'golden' | 'blue' | 'noir'),
    );
    this.q<HTMLInputElement>('input[name=orbit]').addEventListener('change', (e) => engine.setPhotoOrbit((e.target as HTMLInputElement).checked));
    this.q<HTMLInputElement>('input[name=freeze]').addEventListener('change', (e) => (ph.freeze = (e.target as HTMLInputElement).checked));
    this.q('[data-act=capture]').addEventListener('click', () => this.result(engine.capture()));
    this.q('[data-act=hide]').addEventListener('click', () => this.toggleHidden());
    this.q('[data-act=exit]').addEventListener('click', () => engine.exitPhoto());
    window.addEventListener('keydown', (e) => {
      if (engine.mode === 'photo' && e.code === 'KeyH') this.toggleHidden();
    });
    // Keep keyboard focus away from sliders so WASD drives the camera.
    this.root.addEventListener('change', () => (document.activeElement as HTMLElement | null)?.blur?.());
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    this.hiddenUI = false;
    this.root.classList.remove('collapsed');
    if (v) {
      this.status.textContent = '';
      this.q<HTMLSelectElement>('select[name=lighting]').value = 'natural';
      this.q<HTMLInputElement>('input[name=orbit]').checked = false;
      this.q<HTMLInputElement>('input[name=freeze]').checked = this.engine.photo.freeze;
      this.root.querySelectorAll<HTMLInputElement & { refresh?: () => void }>('input[type=range]').forEach((i) => i.refresh?.());
      this.renderGallery();
    }
  }

  private toggleHidden(): void {
    this.hiddenUI = !this.hiddenUI;
    this.root.classList.toggle('collapsed', this.hiddenUI);
  }

  result(r: CaptureResult): void {
    if (r.ok) {
      this.status.textContent = `Download started: ${r.capture.filename}`;
      this.status.className = 'photo-status ok';
    } else {
      this.status.textContent = r.error;
      this.status.className = 'photo-status error';
    }
    this.renderGallery();
  }

  private renderGallery(): void {
    const caps = this.engine.captures;
    this.gallery.innerHTML = caps.length ? '<h3>Recent captures (this session)</h3>' : '';
    for (const c of caps) {
      const a = el('a', 'thumb');
      a.href = c.url;
      a.download = c.filename;
      a.title = `Download ${c.filename} again`;
      a.innerHTML = `<img alt="${escapeHtml(c.filename)}" src="${c.thumb}">`;
      this.gallery.appendChild(a);
    }
  }
}
