export type GraphicsPreset = 'performance' | 'balanced' | 'cinematic';

export interface SettingsData {
  sensitivity: number;
  volume: number;
  muted: boolean;
  graphics: GraphicsPreset;
  reducedMotion: boolean;
  showPerf: boolean;
  fov: number;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: SettingsData = {
  sensitivity: 1,
  volume: 0.7,
  muted: false,
  graphics: 'balanced',
  reducedMotion: false,
  showPerf: false,
  fov: 70,
  invertY: false,
};

const STORAGE_KEY = 'liminal-worlds:settings:v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Returns localStorage when usable, otherwise an in-memory fallback (private mode, sandboxed iframes). */
export function safeStorage(): KeyValueStore {
  try {
    const probe = '__lw_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}

type Listener = (data: SettingsData, changed: keyof SettingsData) => void;

export class Settings {
  data: SettingsData;
  private listeners: Listener[] = [];

  constructor(private store: KeyValueStore) {
    this.data = Settings.parse(store.getItem(STORAGE_KEY));
  }

  static parse(raw: string | null): SettingsData {
    const data = { ...DEFAULT_SETTINGS };
    if (!raw) return data;
    try {
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]) {
        const value = parsed[key];
        if (value !== undefined && typeof value === typeof DEFAULT_SETTINGS[key]) {
          (data as unknown as Record<string, unknown>)[key] = value;
        }
      }
      if (!['performance', 'balanced', 'cinematic'].includes(data.graphics)) data.graphics = 'balanced';
      data.sensitivity = clamp(data.sensitivity, 0.1, 4);
      data.volume = clamp(data.volume, 0, 1);
      data.fov = clamp(data.fov, 50, 100);
    } catch {
      /* corrupted settings fall back to defaults */
    }
    return data;
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    if (this.data[key] === value) return;
    this.data[key] = value;
    this.store.setItem(STORAGE_KEY, JSON.stringify(this.data));
    for (const l of this.listeners) l(this.data, key);
  }

  onChange(listener: Listener): void {
    this.listeners.push(listener);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
