/**
 * Keyboard + pointer-lock mouse input. Movement keys are polled each frame;
 * discrete actions (E, F, M, G, P, Escape...) are dispatched as events.
 */
export type ActionHandler = (code: string, event: KeyboardEvent) => void;

export class InputManager {
  private keys = new Set<string>();
  private dx = 0;
  private dy = 0;
  private actionHandlers: ActionHandler[] = [];
  private lockHandlers: ((locked: boolean) => void)[] = [];
  /** Mouse-look while not pointer-locked (photo mode drag). */
  dragLook = false;
  private dragging = false;

  constructor(private element: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        if (e.code !== 'Escape') return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.isLocked) e.preventDefault();
      if (!e.repeat) for (const h of this.actionHandlers) h(e.code, e);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.isLocked || (this.dragLook && this.dragging)) {
        // Guard against the occasional huge spike some browsers emit on lock.
        if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    element.addEventListener('mousedown', () => (this.dragging = true));
    window.addEventListener('mouseup', () => (this.dragging = false));
    document.addEventListener('pointerlockchange', () => {
      const locked = this.isLocked;
      if (!locked) this.reset();
      for (const h of this.lockHandlers) h(locked);
    });
  }

  get isLocked(): boolean {
    return document.pointerLockElement === this.element;
  }

  requestLock(): void {
    if (this.isLocked) return;
    try {
      const result = this.element.requestPointerLock() as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* pointer lock unavailable (e.g. automation); keyboard still works */
    }
  }

  exitLock(): void {
    if (this.isLocked) document.exitPointerLock();
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  /** Movement axis in [-1, 1] from WASD / arrow keys. */
  axis(): { x: number; z: number } {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const z = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    return { x, z };
  }

  consumeMouse(): { dx: number; dy: number } {
    const out = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  onAction(handler: ActionHandler): void {
    this.actionHandlers.push(handler);
  }

  onLockChange(handler: (locked: boolean) => void): void {
    this.lockHandlers.push(handler);
  }

  reset(): void {
    this.keys.clear();
    this.dx = 0;
    this.dy = 0;
    this.dragging = false;
  }
}
