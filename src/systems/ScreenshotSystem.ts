export interface Capture {
  filename: string;
  url: string;
  thumb: string;
}

export type CaptureResult = { ok: true; capture: Capture } | { ok: false; error: string };

/**
 * Exports the WebGL canvas as PNG. `render` must draw the final frame
 * synchronously so the drawing buffer is read before the browser clears it.
 */
export function captureCanvas(canvas: HTMLCanvasElement, render: () => void, worldId: string): CaptureResult {
  try {
    render();
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png') || dataUrl.length < 1000) {
      return { ok: false, error: 'The browser returned an empty image. Your GPU driver may block canvas readback.' };
    }
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `liminal-worlds_${worldId}_${stamp}.png`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, capture: { filename, url, thumb: makeThumb(canvas) } };
  } catch (err) {
    return { ok: false, error: `Capture failed: ${(err as Error).message ?? String(err)}` };
  }
}

function makeThumb(source: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = Math.round((192 * source.height) / Math.max(1, source.width));
  const g = c.getContext('2d');
  if (!g) return '';
  g.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
