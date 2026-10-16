import * as THREE from 'three';
import type { ArchBuilder } from './Builder';

export interface StairSpec {
  /** Bottom-centre of the first step. */
  x: number;
  z: number;
  y0: number;
  /** Direction of ascent in multiples of 90°: 0 = -Z, 1 = +X, 2 = +Z, 3 = -X. */
  facing: 0 | 1 | 2 | 3;
  width: number;
  steps: number;
  rise?: number;
  tread?: number;
  mat: string;
  /** Fill to the ground (massive stair) or float each step as a slab. */
  solid?: boolean;
  slab?: number;
  /** Low side walls / parapets. */
  parapet?: number;
}

const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Straight staircase. Returns the top landing point (centre of last tread top). */
export function staircase(b: ArchBuilder, s: StairSpec): THREE.Vector3 {
  const rise = s.rise ?? 0.25;
  const tread = s.tread ?? 0.45;
  const [dx, dz] = DIRS[s.facing];
  const alongX = dx !== 0;
  for (let i = 0; i < s.steps; i++) {
    const top = s.y0 + rise * (i + 1);
    const bottom = s.solid ? s.y0 : top - (s.slab ?? 0.35);
    const cx = s.x + dx * tread * (i + 0.5);
    const cz = s.z + dz * tread * (i + 0.5);
    b.box(cx, bottom, cz, alongX ? tread : s.width, top - bottom, alongX ? s.width : tread, s.mat);
  }
  if (s.parapet) {
    const len = tread * s.steps;
    const height = rise * s.steps;
    const cx = s.x + dx * len * 0.5;
    const cz = s.z + dz * len * 0.5;
    const ox = alongX ? 0 : s.width / 2 + 0.15;
    const oz = alongX ? s.width / 2 + 0.15 : 0;
    // Sloped parapets are drawn as rotated slabs (visual only) plus stepped colliders.
    const angle = Math.atan2(height, len);
    const q = new THREE.Quaternion();
    const axis = alongX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const sign = alongX ? dx : -dz;
    q.setFromAxisAngle(axis, angle * sign);
    const diag = Math.hypot(len, height);
    for (const side of [-1, 1]) {
      b.box(cx + ox * side, s.y0 + height / 2 - 0.1 + s.parapet / 2, cz + oz * side, alongX ? diag : 0.3, s.parapet, alongX ? 0.3 : diag, s.mat, {
        quaternion: q,
        collide: false,
      });
      for (let i = 0; i < s.steps; i += 2) {
        const px = s.x + dx * tread * (i + 1) + ox * side;
        const pz = s.z + dz * tread * (i + 1) + oz * side;
        b.collideBox(px, s.y0 + rise * i, pz, alongX ? tread * 2 : 0.3, s.parapet + rise * 2, alongX ? 0.3 : tread * 2);
      }
    }
  }
  return new THREE.Vector3(s.x + dx * tread * s.steps, s.y0 + rise * s.steps, s.z + dz * tread * s.steps);
}

export interface SpiralSpec {
  x: number;
  z: number;
  y0: number;
  radius: number;
  width: number;
  steps: number;
  rise?: number;
  /** Angle per step in radians. */
  angleStep?: number;
  startAngle?: number;
  mat: string;
  core?: string;
}

/** Spiral stair winding around a core column. Visual steps are rotated; colliders are approximated. */
export function spiralStair(b: ArchBuilder, s: SpiralSpec): THREE.Vector3 {
  const rise = s.rise ?? 0.24;
  const step = s.angleStep ?? 0.12;
  const a0 = s.startAngle ?? 0;
  const mid = s.radius + s.width / 2;
  const tread = mid * step * 1.25;
  let last = new THREE.Vector3();
  for (let i = 0; i < s.steps; i++) {
    const a = a0 + i * step;
    const x = s.x + Math.cos(a) * mid;
    const z = s.z + Math.sin(a) * mid;
    const top = s.y0 + rise * (i + 1);
    b.box(x, top - 0.3, z, s.width, 0.3, tread, s.mat, { rotY: -a, collide: false });
    // Collider: small square centred on the tread (safe under rotation).
    b.collision.addCentered(x, z, Math.min(s.width, tread) * 1.05, Math.min(s.width, tread) * 1.05, top - 0.3, top);
    // Extra half-steps along the radius so the walkable band is wide enough.
    for (const f of [-0.3, 0.3]) {
      const rx = s.x + Math.cos(a) * (mid + f * s.width);
      const rz = s.z + Math.sin(a) * (mid + f * s.width);
      b.collision.addCentered(rx, rz, tread, tread, top - 0.3, top);
    }
    last = new THREE.Vector3(x, top, z);
  }
  if (s.core) b.cylinder(s.x, s.y0, s.z, s.radius, rise * s.steps + 2, s.core);
  return last;
}
