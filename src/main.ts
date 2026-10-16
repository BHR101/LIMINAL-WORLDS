import './styles/main.css';
import { Engine } from './core/Engine';
import { UI } from './ui/UI';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fatal(title: string, detail: string): void {
  const root = document.getElementById('ui')!;
  root.innerHTML = `<div class="fatal"><h1>LIMINAL WORLDS</h1><h2>${title}</h2><p>${detail}</p></div>`;
}

async function start(): Promise<void> {
  if (!webglAvailable()) {
    fatal('WebGL is not available', 'This experience needs a browser with WebGL enabled. Try a recent Chrome, Edge, Firefox or Safari on a desktop computer, and check that hardware acceleration is turned on.');
    return;
  }
  let engine: Engine;
  try {
    engine = new Engine(document.getElementById('viewport')!);
  } catch (err) {
    console.error(err);
    fatal('The renderer could not start', `Your browser reported: ${(err as Error).message}. Hardware acceleration may be disabled.`);
    return;
  }
  const ui = new UI(document.getElementById('ui')!, engine);
  engine.ui = ui;
  (window as unknown as { liminal: unknown }).liminal = { engine, ui };
  try {
    await engine.boot();
  } catch (err) {
    console.error(err);
    fatal('Something went wrong while building the world', (err as Error).message);
  }
}

void start();
