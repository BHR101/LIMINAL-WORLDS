import * as THREE from 'three';

/** Lightweight FPS / frame-time / renderer overlay. */
export class PerformanceMonitor {
  readonly element: HTMLElement;
  private frames = 0;
  private acc = 0;
  private worst = 0;
  private gpu = 'unknown';
  visible = false;
  fps = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.element = document.createElement('div');
    this.element.className = 'perf';
    this.element.setAttribute('aria-hidden', 'true');
    const gl = renderer.getContext();
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    } catch {
      /* not exposed */
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.element.style.display = v ? 'block' : 'none';
  }

  /** Call once per frame with the real frame delta in seconds. */
  tick(dt: number, preset: string): void {
    this.frames++;
    this.acc += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.acc < 0.5) return;
    this.fps = this.frames / this.acc;
    if (this.visible) {
      const info = this.renderer.info;
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.element.textContent =
        `${this.fps.toFixed(0)} fps  ·  ${((this.acc / this.frames) * 1000).toFixed(1)} ms avg  ·  ${(this.worst * 1000).toFixed(0)} ms worst\n` +
        `draw calls ${info.render.calls}  ·  triangles ${(info.render.triangles / 1000).toFixed(0)}k\n` +
        `${size.x}×${size.y}  ·  preset ${preset}\n${this.gpu}`;
    }
    this.frames = 0;
    this.acc = 0;
    this.worst = 0;
  }
}
