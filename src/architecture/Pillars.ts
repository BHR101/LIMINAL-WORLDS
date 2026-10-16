import * as THREE from 'three';
import type { ArchBuilder } from './Builder';

export type PillarStyle = 'square' | 'round' | 'cruciform' | 'fluted' | 'stepped';

export interface PillarSpec {
  x: number;
  z: number;
  y0?: number;
  height: number;
  /** Half-width for square styles, radius for round. */
  size: number;
  style?: PillarStyle;
  mat: string;
  capital?: boolean;
  base?: boolean;
}

/** One column with optional plinth and capital. */
export function pillar(b: ArchBuilder, s: PillarSpec): void {
  const y0 = s.y0 ?? 0;
  const w = s.size * 2;
  let y = y0;
  let h = s.height;
  if (s.base) {
    b.box(s.x, y, s.z, w * 1.35, 0.6, w * 1.35, s.mat);
    y += 0.6;
    h -= 0.6;
  }
  const capH = s.capital ? Math.min(1.4, s.height * 0.06) : 0;
  h -= capH;
  switch (s.style ?? 'square') {
    case 'round':
      b.cylinder(s.x, y, s.z, s.size, h, s.mat);
      break;
    case 'cruciform':
      b.box(s.x, y, s.z, w, h, w * 0.45, s.mat);
      b.box(s.x, y, s.z, w * 0.45, h, w, s.mat);
      break;
    case 'fluted': {
      b.cylinder(s.x, y, s.z, s.size * 0.86, h, s.mat);
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        b.box(s.x + Math.cos(a) * s.size * 0.86, y, s.z + Math.sin(a) * s.size * 0.86, s.size * 0.22, h, s.size * 0.22, s.mat, {
          rotY: -a,
          collide: false,
        });
      }
      break;
    }
    case 'stepped': {
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const f = 1 - i * 0.18;
        const th = h / tiers;
        b.box(s.x, y + th * i, s.z, w * f, th, w * f, s.mat);
      }
      break;
    }
    default:
      b.box(s.x, y, s.z, w, h, w, s.mat);
  }
  if (s.capital) {
    b.box(s.x, y + h, s.z, w * 1.5, capH * 0.45, w * 1.5, s.mat);
    b.box(s.x, y + h + capH * 0.45, s.z, w * 1.9, capH * 0.55, w * 1.9, s.mat);
  }
}

export interface ColonnadeSpec extends Omit<PillarSpec, 'x' | 'z'> {
  start: THREE.Vector3;
  direction: THREE.Vector3;
  count: number;
  spacing: number;
}

/** A row of columns along a direction. */
export function colonnade(b: ArchBuilder, s: ColonnadeSpec): THREE.Vector3[] {
  const dir = s.direction.clone().setY(0).normalize();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < s.count; i++) {
    const p = s.start.clone().addScaledVector(dir, i * s.spacing);
    pillar(b, { ...s, x: p.x, z: p.z, y0: s.y0 ?? s.start.y });
    points.push(p);
  }
  return points;
}
