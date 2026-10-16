import { el, escapeHtml } from './dom';

/** Minimal in-world overlay: prompts, world name, hints, toasts. */
export class HUD {
  readonly root = el('div', 'hud');
  private prompt = el('div', 'hud-prompt');
  private worldName = el('div', 'hud-world');
  private hints = el('div', 'hud-hints');
  private toasts = el('div', 'hud-toasts');
  private lock = el('div', 'hud-lock', 'Click to look around');
  private cross = el('div', 'hud-cross');
  private badge = el('div', 'hud-badge', 'Cinematic · press G or move to return');
  private hintTimer = 0;
  private worldTimer = 0;

  constructor() {
    this.prompt.setAttribute('role', 'status');
    this.toasts.setAttribute('aria-live', 'polite');
    this.hints.innerHTML = [
      ['WASD', 'move'],
      ['Mouse', 'look'],
      ['Shift', 'sprint'],
      ['Space', 'jump'],
      ['E', 'interact'],
      ['P', 'photograph'],
      ['G', 'cinematic'],
      ['Esc', 'pause'],
    ]
      .map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`)
      .join('');
    this.root.append(this.cross, this.prompt, this.worldName, this.hints, this.toasts, this.lock, this.badge);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  setPrompt(text: string | null): void {
    const html = text ? `<kbd>E</kbd>${escapeHtml(text)}` : '';
    if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
    this.prompt.classList.toggle('show', !!text);
  }

  announce(numeral: string, name: string, subtitle: string): void {
    this.worldName.innerHTML = `<span class="num">${escapeHtml(numeral)}</span><span class="name">${escapeHtml(name)}</span><span class="sub">${escapeHtml(subtitle)}</span>`;
    this.worldName.classList.add('show', 'intro');
    window.clearTimeout(this.worldTimer);
    this.worldTimer = window.setTimeout(() => this.worldName.classList.remove('intro'), 6000);
  }

  showHints(): void {
    this.hints.classList.add('show');
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hints.classList.remove('show'), 9000);
  }

  toast(title: string, body?: string): void {
    const t = el('div', 'toast', `<strong>${escapeHtml(title)}</strong>${body ? `<span>${escapeHtml(body)}</span>` : ''}`);
    this.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    window.setTimeout(() => {
      t.classList.remove('show');
      window.setTimeout(() => t.remove(), 900);
    }, 4200);
  }

  setLockHint(show: boolean): void {
    this.lock.classList.toggle('show', show);
  }

  setBadge(show: boolean): void {
    this.badge.classList.toggle('show', show);
  }
}
