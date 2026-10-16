import * as THREE from 'three';
import type { ArchBuilder } from './Builder';

export type Side = 'n' | 's' | 'e' | 'w';

export interface Opening {
  side: Side;
  /** Offset of the opening centre along the wall from the wall's middle. */
  offset?: number;
  width: number;
  height: number;
  /** Sill height (0 for doors). */
  sill?: number;
}

export interface RoomSpec {
  x: number;
  z: number;
  y0?: number;
  /** Interior width (X) and depth (Z). */
  width: number;
  depth: number;
  height: number;
  wall?: number;
  mat: string;
  floorMat?: string;
  ceilingMat?: string;
  floor?: boolean;
  ceiling?: boolean;
  openings?: Opening[];
  /** Skip some walls entirely (open sides). */
  omit?: Side[];
}

/**
 * Rectangular room with real door and window openings. North is -Z, south +Z,
 * east +X, west -X. Walls are split around openings so collision matches.
 */
export function room(b: ArchBuilder, s: RoomSpec): void {
  const y0 = s.y0 ?? 0;
  const t = s.wall ?? 0.5;
  const W = s.width;
  const D = s.depth;
  if (s.floor !== false) b.box(s.x, y0 - 0.5, s.z, W + t * 2, 0.5, D + t * 2, s.floorMat ?? s.mat);
  if (s.ceiling !== false) b.box(s.x, y0 + s.height, s.z, W + t * 2, 0.5, D + t * 2, s.ceilingMat ?? s.mat);
  const sides: Side[] = ['n', 's', 'e', 'w'];
  for (const side of sides) {
    if (s.omit?.includes(side)) continue;
    const alongX = side === 'n' || side === 's';
    const len = alongX ? W + t * 2 : D;
    const cx = side === 'e' ? s.x + W / 2 + t / 2 : side === 'w' ? s.x - W / 2 - t / 2 : s.x;
    const cz = side === 'n' ? s.z - D / 2 - t / 2 : side === 's' ? s.z + D / 2 + t / 2 : s.z;
    const openings = (s.openings ?? []).filter((o) => o.side === side).sort((a, b2) => (a.offset ?? 0) - (b2.offset ?? 0));
    wallWithOpenings(b, cx, y0, cz, len, s.height, t, alongX, openings, s.mat);
  }
}

/** A straight wall segment with rectangular openings punched through. */
export function wallWithOpenings(
  b: ArchBuilder,
  cx: number,
  y0: number,
  cz: number,
  len: number,
  height: number,
  t: number,
  alongX: boolean,
  openings: Opening[],
  mat: string,
): void {
  const seg = (from: number, to: number, yb: number, yt: number) => {
    if (to - from < 0.01 || yt - yb < 0.01) return;
    const mid = (from + to) / 2;
    const l = to - from;
    if (alongX) b.box(cx + mid, yb, cz, l, yt - yb, t, mat);
    else b.box(cx, yb, cz + mid, t, yt - yb, l, mat);
  };
  let cursor = -len / 2;
  for (const o of openings) {
    const a = (o.offset ?? 0) - o.width / 2;
    const c = (o.offset ?? 0) + o.width / 2;
    seg(cursor, a, y0, y0 + height);
    const sill = o.sill ?? 0;
    seg(a, c, y0, y0 + sill);
    seg(a, c, y0 + sill + o.height, y0 + height);
    cursor = c;
  }
  seg(cursor, len / 2, y0, y0 + height);
}

export interface CorridorSpec {
  x: number;
  z: number;
  y0?: number;
  /** Corridor runs along X ('x') or Z ('z'). */
  axis: 'x' | 'z';
  length: number;
  width: number;
  height: number;
  mat: string;
  floorMat?: string;
  /** Repeating ribs (frames) every n metres. */
  ribEvery?: number;
  ribMat?: string;
  /** Slit skylights in the ceiling. */
  skylights?: boolean;
}

/** Long enclosed corridor, open at both ends, with structural ribs. */
export function corridor(b: ArchBuilder, s: CorridorSpec): void {
  const y0 = s.y0 ?? 0;
  const t = 0.6;
  const alongX = s.axis === 'x';
  const L = s.length;
  b.box(s.x, y0 - 0.5, s.z, alongX ? L : s.width + t * 2, 0.5, alongX ? s.width + t * 2 : L, s.floorMat ?? s.mat);
  for (const k of [-1, 1]) {
    const off = k * (s.width / 2 + t / 2);
    b.box(s.x + (alongX ? 0 : off), y0, s.z + (alongX ? off : 0), alongX ? L : t, s.height, alongX ? t : L, s.mat);
  }
  if (s.skylights) {
    const n = Math.floor(L / 3);
    for (let i = 0; i < n; i++) {
      const p = -L / 2 + (i + 0.5) * (L / n);
      const len = (L / n) * 0.7;
      // ceiling beams between slits
      b.box(s.x + (alongX ? p : 0), y0 + s.height, s.z + (alongX ? 0 : p), alongX ? len : s.width + t * 2, 0.5, alongX ? s.width + t * 2 : len, s.mat, { collide: false });
    }
  } else {
    b.box(s.x, y0 + s.height, s.z, alongX ? L : s.width + t * 2, 0.5, alongX ? s.width + t * 2 : L, s.mat, { collide: false });
  }
  if (s.ribEvery) {
    const n = Math.floor(L / s.ribEvery);
    for (let i = 0; i <= n; i++) {
      const p = -L / 2 + i * s.ribEvery;
      const mat = s.ribMat ?? s.mat;
      for (const k of [-1, 1]) {
        const off = k * (s.width / 2 - 0.15);
        b.box(s.x + (alongX ? p : off), y0, s.z + (alongX ? off : p), alongX ? 0.5 : 0.3, s.height, alongX ? 0.3 : 0.5, mat, { collide: false });
      }
      b.box(s.x + (alongX ? p : 0), y0 + s.height - 0.5, s.z + (alongX ? 0 : p), alongX ? 0.5 : s.width, 0.5, alongX ? s.width : 0.5, mat, { collide: false });
    }
  }
}

export interface PlatformSpec {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  thickness?: number;
  mat: string;
  /** Inverted pyramid hanging beneath — reads as "floating". */
  keel?: number;
  rotY?: number;
  edgeMat?: string;
}

/** Floating platform whose walkable top is at y. */
export function platform(b: ArchBuilder, s: PlatformSpec): void {
  const t = s.thickness ?? 1.2;
  b.box(s.x, s.y - t, s.z, s.width, t, s.depth, s.mat, { rotY: s.rotY });
  if (s.edgeMat) b.box(s.x, s.y - t - 0.15, s.z, s.width + 0.2, 0.15, s.depth + 0.2, s.edgeMat, { rotY: s.rotY, collide: false });
  if (s.keel) {
    const geo = b.geometry('keel', () => {
      const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
      g.rotateY(Math.PI / 4);
      g.rotateX(Math.PI);
      g.translate(0, -0.5, 0);
      return g;
    });
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(s.x, s.y - t, s.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY ?? 0),
      new THREE.Vector3(s.width, s.keel, s.depth),
    );
    b.instance(geo, s.mat, m);
  }
}

export interface RingSpec {
  center: THREE.Vector3;
  radius: number;
  /** Square cross-section half-size. */
  thickness: number;
  mat: string;
  rotation?: THREE.Euler;
  segments?: number;
  /** Slow rotation speed (rad/s) about its own axis; 0 for static. */
  spin?: number;
  spinAxis?: THREE.Vector3;
}

/** Monumental square-section ring. Returned mesh is animated by the builder. */
export function ring(b: ArchBuilder, s: RingSpec): THREE.Mesh {
  const geo = b.geometry(`ring:${s.radius}:${s.thickness}`, () => {
    const g = new THREE.TorusGeometry(s.radius, s.thickness, 4, s.segments ?? 160);
    return g;
  });
  const mesh = new THREE.Mesh(geo, b.mat(s.mat));
  mesh.position.copy(s.center);
  if (s.rotation) mesh.rotation.copy(s.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  b.add(mesh);
  if (s.spin) {
    const axis = (s.spinAxis ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
    const speed = s.spin;
    b.animate((dt) => mesh.rotateOnAxis(axis, speed * dt));
  }
  return mesh;
}

export type SculptureKind = 'octahedron' | 'tetrahedron' | 'cube' | 'icosahedron' | 'nested' | 'shard';

export interface SculptureSpec {
  position: THREE.Vector3;
  size: number;
  kind: SculptureKind;
  mat: string;
  innerMat?: string;
  /** Bobbing amplitude in metres. */
  float?: number;
  spin?: number;
  phase?: number;
}

/** Floating geometric sculpture. Returns the group (animated). */
export function sculpture(b: ArchBuilder, s: SculptureSpec): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(s.position);
  const make = (kind: SculptureKind, size: number, mat: string): THREE.Mesh => {
    const geo = b.geometry(`sculpt:${kind}`, () => {
      switch (kind) {
        case 'tetrahedron':
          return new THREE.TetrahedronGeometry(1, 0);
        case 'cube':
          return new THREE.BoxGeometry(1.2, 1.2, 1.2);
        case 'icosahedron':
          return new THREE.IcosahedronGeometry(1, 0);
        case 'shard': {
          const g = new THREE.OctahedronGeometry(1, 0);
          g.scale(0.35, 1.6, 0.35);
          return g;
        }
        default:
          return new THREE.OctahedronGeometry(1, 0);
      }
    });
    const m = new THREE.Mesh(geo, b.mat(mat));
    m.scale.setScalar(size);
    m.castShadow = true;
    return m;
  };
  if (s.kind === 'nested') {
    const outer = make('cube', s.size, s.mat);
    const inner = make('octahedron', s.size * 0.55, s.innerMat ?? s.mat);
    outer.rotation.set(0.6, 0.3, 0.2);
    group.add(outer, inner);
    b.animate((dt) => {
      outer.rotation.y += dt * 0.07;
      inner.rotation.y -= dt * 0.25;
      inner.rotation.x += dt * 0.11;
    });
  } else {
    const m = make(s.kind, s.size, s.mat);
    m.rotation.set(0.4, 0, 0.2);
    group.add(m);
  }
  const phase = s.phase ?? s.position.x * 0.13 + s.position.z * 0.07;
  const baseY = s.position.y;
  const amp = s.float ?? 0.6;
  const spin = s.spin ?? 0.12;
  b.animate((dt, t) => {
    group.position.y = baseY + Math.sin(t * 0.35 + phase) * amp;
    group.rotation.y += spin * dt;
  });
  b.add(group);
  return group;
}

export interface DoorframeSpec {
  x: number;
  z: number;
  y0?: number;
  rotY?: number;
  width: number;
  height: number;
  frame?: number;
  depth?: number;
  mat: string;
}

/** Monumental rectangular doorframe (posts + lintel), opening along local Z. */
export function doorframe(b: ArchBuilder, s: DoorframeSpec): void {
  const y0 = s.y0 ?? 0;
  const f = s.frame ?? 0.6;
  const d = s.depth ?? 1;
  const rot = s.rotY ?? 0;
  const ax = Math.cos(rot);
  const az = -Math.sin(rot);
  const off = s.width / 2 + f / 2;
  b.box(s.x + ax * off, y0, s.z + az * off, f, s.height + f, d, s.mat, { rotY: rot });
  b.box(s.x - ax * off, y0, s.z - az * off, f, s.height + f, d, s.mat, { rotY: rot });
  b.box(s.x, y0 + s.height, s.z, s.width, f, d, s.mat, { rotY: rot });
}
