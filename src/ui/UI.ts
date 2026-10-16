import type { Engine, EngineUI } from '../core/Engine';
import type { CaptureResult } from '../systems/ScreenshotSystem';
import { HUD } from './HUD';
import { Menu } from './Menu';
import { PhotoPanel } from './PhotoMode';
import { el } from './dom';

/** Root UI controller: implements the engine's UI surface. */
export class UI implements EngineUI {
  private hud = new HUD();
  private menu: Menu;
  private photo: PhotoPanel;
  private loading = el('div', 'loading', '<div class="spinner"></div><p></p>');

  constructor(root: HTMLElement, engine: Engine) {
    this.menu = new Menu(engine);
    this.photo = new PhotoPanel(engine);
    root.append(this.hud.root, this.menu.root, this.photo.root, this.loading, engine.perf.element);
    this.hud.setVisible(false);
  }

  showTitle(show: boolean): void {
    if (show) this.menu.show('title');
    else if (this.menu.screen !== 'pause') this.menu.show('none');
    document.body.classList.toggle('on-title', show);
  }

  showPause(show: boolean): void {
    this.menu.show(show ? 'pause' : 'none');
    document.body.classList.toggle('paused', show);
  }

  setPrompt(text: string | null): void {
    this.hud.setPrompt(text);
  }

  toast(title: string, body?: string): void {
    this.hud.toast(title, body);
  }

  announceWorld(numeral: string, name: string, subtitle: string): void {
    this.hud.announce(numeral, name, subtitle);
  }

  showHints(): void {
    this.hud.showHints();
  }

  setLockHint(show: boolean): void {
    this.hud.setLockHint(show);
  }

  setHudVisible(show: boolean): void {
    this.hud.setVisible(show);
  }

  showPhoto(show: boolean): void {
    this.photo.show(show);
  }

  setCinematicBadge(show: boolean): void {
    this.hud.setBadge(show);
  }

  setLoading(text: string | null): void {
    this.loading.classList.toggle('show', !!text);
    this.loading.querySelector('p')!.textContent = text ?? '';
  }

  photoResult(r: CaptureResult): void {
    this.photo.result(r);
  }
}
