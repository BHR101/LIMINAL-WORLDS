import * as THREE from 'three';
import type { ArchBuilder } from './Builder';

export interface BridgeSpec {
  from: THREE.Vector3;
  to: THREE.Vector3;
  width: number;
  thickness?: number;
  mat: string;
  railMat?: string;
  rails?: boolean;
  railHeight?: number;
  /** Decorative undersides: 'flat' | 'arched' (hanging ribs) */
  underside?: 'flat' | 'ribbed';
}

/**
 * A straight bridge deck between two points (may slope gently). The deck is
 * rendered as one rotated slab; collision is a chain of short boxes so that
 * diagonal and sloped bridges remain walkable.
 */
export function bridge(b: ArchBuilder, s: BridgeSpec): void {
  const t = s.thickness ?? 0.8;
  const dir = new THREE.Vector3().subVectors(s.to, s.from);
  const len = dir.length();
  const flat = Math.hypot(dir.x, dir.z);
  const yaw = Math.atan2(dir.x, dir.z);
  const pitch = Math.atan2(dir.y, flat);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
  const mid = s.from.clone().add(s.to).multiplyScalar(0.5);
  const railH = s.railHeight ?? 1.05;
  b.box(mid.x, mid.y - t, mid.z, s.width, t, len, s.mat, { quaternion: q, collide: false });
  if (s.rails !== false) {
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const k of [-1, 1]) {
      const p = mid.clone().addScaledVector(side, k * (s.width / 2 - 0.15));
      b.box(p.x, p.y, p.z, 0.3, railH, len, s.railMat ?? s.mat, { quaternion: q, collide: false });
    }
  }
  if (s.underside === 'ribbed') {
    const n = Math.max(2, Math.floor(len / 6));
    for (let i = 1; i < n; i++) {
      const p = s.from.clone().lerp(s.to, i / n);
      b.box(p.x, p.y - t - 1.6, p.z, s.width * 0.7, 1.6, 0.6, s.mat, { rotY: yaw, collide: false, castShadow: true });
    }
  }
  // Collision chain.
  const segs = Math.max(1, Math.ceil(len / 0.8));
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const axisAligned = Math.abs(Math.sin(yaw * 2)) < 1e-3;
  for (let i = 0; i < segs; i++) {
    const p = s.from.clone().lerp(s.to, (i + 0.5) / segs);
    const segLen = flat / segs + 0.3;
    if (axisAligned) {
      b.collideBox(p.x, p.y - t, p.z, s.width, t, segLen, yaw);
    } else {
      // Diagonal: tile the deck width with small squares.
      const cells = Math.max(1, Math.ceil(s.width / 0.9));
      for (let c = 0; c < cells; c++) {
        const off = (c + 0.5) / cells - 0.5;
        const cp = p.clone().addScaledVector(side, off * s.width);
        b.collision.addCentered(cp.x, cp.z, 0.95, 0.95, p.y - t, p.y);
      }
    }
    if (s.rails !== false) {
      for (const k of [-1, 1]) {
        const rp = p.clone().addScaledVector(side, k * (s.width / 2 - 0.15));
        b.collision.addCentered(rp.x, rp.z, 0.35, 0.35, p.y - 0.2, p.y + railH);
      }
    }
  }
}
