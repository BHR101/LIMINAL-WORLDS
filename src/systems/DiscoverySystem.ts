import * as THREE from 'three';
import type { KeyValueStore } from '../core/Settings';
import { DISCOVERIES } from '../worlds/discoveries';
import type { DiscoverySpot } from '../worlds/types';

const KEY = 'liminal-worlds:discoveries:v1';
const _dir = new THREE.Vector3();

/** Tracks and persists found secrets. */
export class DiscoverySystem {
  private found = new Set<string>();
  private listeners: ((id: string) => void)[] = [];

  constructor(private store: KeyValueStore) {
    try {
      const raw = store.getItem(KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(list)) for (const id of list) if (typeof id === 'string' && DISCOVERIES.some((d) => d.id === id)) this.found.add(id);
    } catch {
      /* ignore corrupt data */
    }
  }

  isFound(id: string): boolean {
    return this.found.has(id);
  }

  get count(): number {
    return this.found.size;
  }

  get total(): number {
    return DISCOVERIES.length;
  }

  /** Returns true if this was a new discovery. */
  mark(id: string): boolean {
    if (this.found.has(id) || !DISCOVERIES.some((d) => d.id === id)) return false;
    this.found.add(id);
    this.store.setItem(KEY, JSON.stringify([...this.found]));
    for (const l of this.listeners) l(id);
    return true;
  }

  reset(): void {
    this.found.clear();
    this.store.setItem(KEY, '[]');
  }

  onDiscover(fn: (id: string) => void): void {
    this.listeners.push(fn);
  }

  /** Check walk-in and look-at spots for the current frame. */
  check(spots: DiscoverySpot[], eye: THREE.Vector3, forward: THREE.Vector3): void {
    for (const s of spots) {
      if (s.mode === 'interact' || this.found.has(s.id)) continue;
      const dx = eye.x - s.position.x;
      const dz = eye.z - s.position.z;
      const dy = eye.y - s.position.y;
      if (dx * dx + dz * dz > s.radius * s.radius || Math.abs(dy) > Math.max(4, s.radius)) continue;
      if (s.mode === 'view' && s.lookAt) {
        _dir.subVectors(s.lookAt, eye).normalize();
        if (_dir.dot(forward) < 0.97) continue;
      }
      if (this.mark(s.id)) s.onDiscover?.();
    }
  }
}
