import type { Engine } from '../core/Engine';
import { randomSeed } from '../core/rng';
import { WORLDS } from '../worlds/WorldRegistry';
import { DISCOVERIES } from '../worlds/discoveries';
import { buildSettings } from './SettingsPanel';
import { button, el, escapeHtml } from './dom';

type Screen = 'title' | 'pause' | 'worlds' | 'settings' | 'controls' | 'journal' | 'none';

const CONTROLS: [string, string][] = [
  ['W A S D / arrows', 'Move · in fractal worlds you fly where you look'],
  ['Mouse', 'Look (click the view to capture the pointer)'],
  ['Shift', 'Sprint'],
  ['Space', 'Jump · in fractal worlds, rise'],
  ['C', 'Descend (fractal worlds)'],
  ['E', 'Interact · step through portals'],
  ['Esc', 'Pause and release the pointer'],
  ['F', 'Toggle fullscreen'],
  ['M', 'Mute / unmute'],
  ['G', 'Cinematic camera'],
  ['P', 'Photography mode'],
  ['`', 'Performance overlay'],
  ['Photo mode', 'Drag to look · WASD move · Space/C up/down · Enter capture · H hide panel'],
];

/** Title screen, pause menu and the panels they open. */
export class Menu {
  readonly root = el('div', 'menus');
  private screens = new Map<Screen, HTMLElement>();
  private current: Screen = 'none';
  private returnTo: Screen = 'title';
  private selectedWorld = WORLDS[0].id;
  private seedInput!: HTMLInputElement;

  constructor(private engine: Engine) {
    this.screens.set('title', this.buildTitle());
    this.screens.set('pause', this.buildPause());
    this.screens.set('worlds', this.buildWorlds());
    this.screens.set('settings', this.buildPanel('Settings', buildSettings(engine)));
    this.screens.set('controls', this.buildPanel('Controls', this.controlsTable()));
    this.screens.set('journal', this.buildPanel('Discovery Journal', el('div', 'journal')));
    for (const s of this.screens.values()) {
      s.classList.add('screen');
      this.root.appendChild(s);
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && ['worlds', 'settings', 'controls', 'journal'].includes(this.current)) {
        e.preventDefault();
        this.show(this.returnTo);
      }
    });
  }

  show(screen: Screen): void {
    this.current = screen;
    for (const [name, node] of this.screens) node.classList.toggle('active', name === screen);
    if (screen === 'journal') this.renderJournal();
    if (screen === 'worlds') this.refreshWorlds();
    const node = this.screens.get(screen);
    const focusable = node?.querySelector<HTMLElement>('button, [tabindex]');
    window.setTimeout(() => focusable?.focus({ preventScroll: true }), 50);
  }

  get screen(): Screen {
    return this.current;
  }

  private open(screen: Screen): void {
    this.returnTo = this.current === 'pause' ? 'pause' : 'title';
    this.show(screen);
  }

  private buildTitle(): HTMLElement {
    const s = el('section', 'title-screen');
    s.innerHTML = `
      <div class="title-block">
        <h1 aria-label="Liminal Worlds"><span>LIMINAL</span><span>WORLDS</span></h1>
        <p class="tagline">Somewhere between geometry and memory.</p>
      </div>`;
    const nav = el('nav', 'menu-list');
    nav.setAttribute('aria-label', 'Main menu');
    nav.append(
      button('Enter the World', () => this.engine.enterWorld(WORLDS[0].id), 'menu-item primary'),
      button('Explore a Random World', () => this.engine.enterWorld('random', { seed: randomSeed() }), 'menu-item'),
      button('World Selection', () => this.open('worlds'), 'menu-item'),
      button('Settings', () => this.open('settings'), 'menu-item'),
      button('Controls', () => this.open('controls'), 'menu-item'),
      button('Discovery Journal', () => this.open('journal'), 'menu-item subtle'),
    );
    s.appendChild(nav);
    s.appendChild(
      el(
        'footer',
        'title-footer',
        `<span>Eight worlds · fractals, illusions and impossible architecture · open source</span><span class="device-note">Best on a desktop browser with keyboard and mouse · headphones recommended</span>`,
      ),
    );
    return s;
  }

  private buildPause(): HTMLElement {
    const s = el('section', 'pause-screen');
    s.innerHTML = `<h2>Paused</h2>`;
    const nav = el('nav', 'menu-list');
    nav.append(
      button('Resume', () => this.engine.resume(), 'menu-item primary'),
      button('Cinematic Mode', () => this.engine.toggleCinematic(true), 'menu-item'),
      button('Restart World', () => this.engine.restartWorld(), 'menu-item'),
      button('World Selection', () => this.open('worlds'), 'menu-item'),
      button('Settings', () => this.open('settings'), 'menu-item'),
      button('Discovery Journal', () => this.open('journal'), 'menu-item'),
      button('Controls', () => this.open('controls'), 'menu-item'),
      button('Return to Title', () => this.engine.toTitle(), 'menu-item subtle'),
    );
    s.appendChild(nav);
    return s;
  }

  private buildPanel(title: string, body: HTMLElement): HTMLElement {
    const s = el('section', 'panel');
    const head = el('header', 'panel-head', `<h2>${escapeHtml(title)}</h2>`);
    head.appendChild(button('Back', () => this.show(this.returnTo), 'btn ghost'));
    s.append(head, body);
    return s;
  }

  private controlsTable(): HTMLElement {
    const t = el('div', 'controls-table');
    t.innerHTML = CONTROLS.map(([k, v]) => `<div class="ctl"><kbd>${escapeHtml(k)}</kbd><span>${escapeHtml(v)}</span></div>`).join('');
    const note = el(
      'p',
      'note',
      'Designed for desktop browsers. Touch navigation is not implemented — on phones and tablets the title sequence plays, but exploring needs a keyboard and mouse.',
    );
    t.appendChild(note);
    return t;
  }

  private buildWorlds(): HTMLElement {
    const body = el('div', 'world-select');
    const grid = el('div', 'world-grid');
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', 'Worlds');
    const cards: HTMLElement[] = [];
    const select = (id: string) => {
      this.selectedWorld = id;
      cards.forEach((c) => {
        const on = c.dataset.id === id;
        c.classList.toggle('selected', on);
        c.setAttribute('aria-selected', String(on));
      });
    };
    const entries = [...WORLDS.map((w) => ({ id: w.id, numeral: w.numeral, name: w.name, desc: w.description })), {
      id: 'random',
      numeral: '∞',
      name: 'A Random World',
      desc: 'Seeded procedural composition: palette, weather, layout and modules recombined. Share a seed to share a world.',
    }];
    for (const w of entries) {
      const card = el('button', 'world-card');
      card.type = 'button';
      card.dataset.id = w.id;
      card.setAttribute('role', 'option');
      card.innerHTML = `
        <div class="preview" style="background-image:url('previews/${w.id}.jpg')"></div>
        <div class="meta"><span class="num">${w.numeral}</span><h3>${escapeHtml(w.name)}</h3><p>${escapeHtml(w.desc)}</p></div>`;
      card.addEventListener('click', () => select(w.id));
      card.addEventListener('dblclick', () => this.enterSelected());
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.selectedWorld === w.id) {
          e.preventDefault();
          this.enterSelected();
        }
      });
      cards.push(card);
      grid.appendChild(card);
    }
    const footer = el('div', 'world-actions');
    const seedLabel = el('label', 'seed', '<span>Seed</span>');
    this.seedInput = el('input');
    this.seedInput.type = 'number';
    this.seedInput.min = '1';
    this.seedInput.value = String(randomSeed());
    seedLabel.appendChild(this.seedInput);
    footer.append(
      seedLabel,
      button('New seed', () => (this.seedInput.value = String(randomSeed())), 'btn small'),
      button('Enter selected world', () => this.enterSelected(), 'btn primary'),
    );
    body.append(grid, footer);
    select(this.selectedWorld);
    return this.buildPanel('World Selection', body);
  }

  private refreshWorlds(): void {
    if (this.engine.worldDef?.id === 'random') this.seedInput.value = String(this.engine.worldSeed);
  }

  private enterSelected(): void {
    const id = this.selectedWorld;
    const seed = id === 'random' ? Math.max(1, Math.floor(Number(this.seedInput.value) || randomSeed())) : 0;
    void this.engine.enterWorld(id, { seed });
  }

  private renderJournal(): void {
    const j = this.screens.get('journal')!.querySelector('.journal')!;
    const d = this.engine.discoveries;
    const groups = WORLDS.map((w) => ({ w, items: DISCOVERIES.filter((x) => x.world === w.id) }));
    j.innerHTML = `<p class="journal-count">${d.count} of ${d.total} discovered</p>` +
      groups
        .map(
          ({ w, items }) => `
        <div class="journal-world"><h3><span class="num">${w.numeral}</span>${escapeHtml(w.name)}</h3>
        ${items
          .map((it) =>
            d.isFound(it.id)
              ? `<div class="entry found"><strong>${escapeHtml(it.title)}</strong><p>${escapeHtml(it.description)}</p></div>`
              : `<div class="entry"><strong>Undiscovered</strong><p>${escapeHtml(it.hint)}</p></div>`,
          )
          .join('')}</div>`,
        )
        .join('');
    const reset = button('Reset discoveries', () => {
      if (window.confirm('Forget every discovery? This cannot be undone.')) {
        d.reset();
        this.renderJournal();
      }
    }, 'btn small ghost');
    j.appendChild(reset);
  }
}
