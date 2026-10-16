import * as THREE from 'three';
import type { ArchBuilder, PlaceOptions } from './Builder';

export type ArchStyle = 'round' | 'pointed' | 'flat' | 'stilted';

export interface ArchSpec {
  x: number;
  z: number;
  y0?: number;
  rotY?: number;
  /** Clear opening width. */
  span: number;
  /** Height of the vertical part of the opening (springing line). */
  legHeight: number;
  /** Width of each pier. */
  pier: number;
  /** Depth (thickness through the opening). */
  depth: number;
  /** Solid material above the crown. */
  crown?: number;
  style?: ArchStyle;
  mat: string;
  collide?: boolean;
  quaternion?: THREE.Quaternion;
}

/** Outer rectangle with an arched opening, extruded. Cached per parameter set. */
export function archGeometry(b: ArchBuilder, span: number, legHeight: number, pier: number, depth: number, crown: number, style: ArchStyle): THREE.BufferGeometry {
  const key = `arch:${span}:${legHeight}:${pier}:${depth}:${crown}:${style}`;
  return b.geometry(key, () => {
    const r = span / 2;
    const archRise = style === 'flat' ? 0 : style === 'pointed' ? r * 1.5 : r;
    const outerW = span + pier * 2;
    const outerH = legHeight + archRise + crown;
    // Single simple polygon: outer frame with the opening cut up from the base.
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(-outerW / 2, 0), new THREE.Vector2(-r, 0), new THREE.Vector2(-r, legHeight));
    const segments = 20;
    if (style === 'round' || style === 'stilted') {
      for (let i = 1; i < segments; i++) {
        const th = Math.PI - (Math.PI * i) / segments;
        pts.push(new THREE.Vector2(r * Math.cos(th), legHeight + r * Math.sin(th)));
      }
    } else if (style === 'pointed') {
      // Two circular arcs meeting at the apex (rise = 1.5 r).
      const R = 1.625 * r;
      const cx = R - r;
      const apex = Math.acos(-cx / R);
      for (let i = 1; i <= segments; i++) {
        const th = Math.PI + ((apex - Math.PI) * i) / segments;
        pts.push(new THREE.Vector2(cx + R * Math.cos(th), legHeight + R * Math.sin(th)));
      }
      for (let i = segments - 1; i >= 1; i--) {
        const th = Math.PI + ((apex - Math.PI) * i) / segments;
        pts.push(new THREE.Vector2(-(cx + R * Math.cos(th)), legHeight + R * Math.sin(th)));
      }
    }
    pts.push(new THREE.Vector2(r, legHeight), new THREE.Vector2(r, 0), new THREE.Vector2(outerW / 2, 0));
    pts.push(new THREE.Vector2(outerW / 2, outerH), new THREE.Vector2(-outerW / 2, outerH));
    const shape = new THREE.Shape(pts);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

/** A single monumental arch with colliding piers and lintel. Returns the total height. */
export function arch(b: ArchBuilder, s: ArchSpec, opts: PlaceOptions = {}): number {
  const crown = s.crown ?? s.pier * 0.8;
  const style = s.style ?? 'round';
  const geo = archGeometry(b, s.span, s.legHeight, s.pier, s.depth, crown, style);
  const y0 = s.y0 ?? 0;
  const rot = s.quaternion ?? _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY ?? 0);
  _m.compose(new THREE.Vector3(s.x, y0, s.z), rot, new THREE.Vector3(1, 1, 1));
  b.instance(geo, s.mat, _m, opts);
  const rise = style === 'flat' ? 0 : style === 'pointed' ? s.span * 0.75 : s.span / 2;
  const total = s.legHeight + rise + crown;
  if (s.collide !== false && !s.quaternion) {
    const rotY = s.rotY ?? 0;
    const off = s.span / 2 + s.pier / 2;
    const ax = Math.cos(rotY);
    const az = -Math.sin(rotY);
    b.collideBox(s.x + ax * off, y0, s.z + az * off, s.pier, total, s.depth, rotY);
    b.collideBox(s.x - ax * off, y0, s.z - az * off, s.pier, total, s.depth, rotY);
    b.collideBox(s.x, y0 + s.legHeight + rise, s.z, s.span, crown, s.depth, rotY);
  }
  return total;
}

export interface ArcadeSpec extends Omit<ArchSpec, 'x' | 'z'> {
  start: THREE.Vector3;
  /** Direction along which arches repeat. */
  direction: THREE.Vector3;
  count: number;
  spacing: number;
  /** Arches face across the direction (an aisle) or along it (a tunnel of arches). */
  facing?: 'across' | 'along';
  /** Optional per-arch scale progression for forced perspective (1 = constant). */
  scaleStep?: number;
}

/** Repeated arches: a tunnel or an aisle wall. */
export function arcade(b: ArchBuilder, s: ArcadeSpec): void {
  const dir = s.direction.clone().setY(0).normalize();
  const baseRot = Math.atan2(-dir.z, dir.x); // rotY that maps local +X onto dir
  const rotY = (s.facing ?? 'along') === 'along' ? baseRot + Math.PI / 2 : baseRot;
  let scale = 1;
  let dist = 0;
  for (let i = 0; i < s.count; i++) {
    const p = s.start.clone().addScaledVector(dir, dist);
    arch(b, {
      ...s,
      x: p.x,
      z: p.z,
      y0: s.y0 ?? s.start.y,
      rotY,
      span: round2(s.span * scale),
      legHeight: round2(s.legHeight * scale),
      pier: round2(s.pier * scale),
      depth: round2(s.depth * scale),
      crown: s.crown !== undefined ? round2(s.crown * scale) : undefined,
    });
    dist += s.spacing * scale;
    scale *= s.scaleStep ?? 1;
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
