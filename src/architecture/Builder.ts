import * as THREE from 'three';
import { CollisionWorld } from '../player/CollisionSystem';

export interface PlaceOptions {
  /** Rotation about Y in radians. Collision is exact for multiples of 90°. */
  rotY?: number;
  /** Full rotation; overrides rotY for rendering and disables collision unless forced. */
  quaternion?: THREE.Quaternion;
  collide?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

type Animator = (dt: number, t: number) => void;

interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  castShadow: boolean;
  receiveShadow: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Collects architectural primitives and turns them into a few InstancedMeshes
 * (one per geometry/material pair) plus AABB colliders. Every generator in
 * src/architecture writes through this class.
 */
export class ArchBuilder {
  readonly root = new THREE.Group();
  readonly collision: CollisionWorld;
  readonly animators: Animator[] = [];
  private batches = new Map<string, Batch>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private ownedMaterials = new Set<THREE.Material>();
  private finalized = false;

  constructor(
    readonly materials: Record<string, THREE.Material>,
    collision?: CollisionWorld,
  ) {
    this.collision = collision ?? new CollisionWorld();
    for (const m of Object.values(materials)) this.ownedMaterials.add(m);
  }

  mat(key: string): THREE.Material {
    const m = this.materials[key];
    if (!m) throw new Error(`Unknown material "${key}"`);
    return m;
  }

  /** Cached geometry by key. */
  geometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geometries.get(key);
    if (!g) {
      g = factory();
      this.geometries.set(key, g);
    }
    return g;
  }

  get unitBox(): THREE.BufferGeometry {
    return this.geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
  }

  get unitCylinder(): THREE.BufferGeometry {
    return this.geometry('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 28, 1));
  }

  /** Add one instance of `geometry` with full transform. */
  instance(geometry: THREE.BufferGeometry, materialKey: string, matrix: THREE.Matrix4, opts: PlaceOptions = {}): void {
    if (this.finalized) throw new Error('Builder already finalized');
    const cast = opts.castShadow ?? true;
    const recv = opts.receiveShadow ?? true;
    const key = `${geometry.uuid}|${materialKey}|${cast ? 1 : 0}${recv ? 1 : 0}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { geometry, material: this.mat(materialKey), matrices: [], castShadow: cast, receiveShadow: recv };
      this.batches.set(key, batch);
    }
    batch.matrices.push(matrix.clone());
  }

  /** Axis-aligned (or Y-rotated) box with its base at y0. */
  box(x: number, y0: number, z: number, sx: number, sy: number, sz: number, mat: string, opts: PlaceOptions = {}): void {
    if (sx <= 0 || sy <= 0 || sz <= 0) return;
    const rot = opts.quaternion ?? _q.setFromAxisAngle(_up, opts.rotY ?? 0);
    _m.compose(_p.set(x, y0 + sy / 2, z), rot, _s.set(sx, sy, sz));
    this.instance(this.unitBox, mat, _m, opts);
    if (opts.collide !== false && (!opts.quaternion || opts.collide)) this.collideBox(x, y0, z, sx, sy, sz, opts.rotY ?? 0);
  }

  /** Vertical cylinder with its base at y0. Collides as an inscribed square. */
  cylinder(x: number, y0: number, z: number, radius: number, height: number, mat: string, opts: PlaceOptions = {}): void {
    _m.compose(_p.set(x, y0 + height / 2, z), opts.quaternion ?? _q.identity(), _s.set(radius, height, radius));
    this.instance(this.unitCylinder, mat, _m, opts);
    if (opts.collide !== false && !opts.quaternion) {
      const s = radius * 1.6;
      this.collision.addCentered(x, z, s, s, y0, y0 + height);
    }
  }

  collideBox(x: number, y0: number, z: number, sx: number, sy: number, sz: number, rotY = 0): void {
    const c = Math.abs(Math.cos(rotY));
    const s = Math.abs(Math.sin(rotY));
    const ex = sx * c + sz * s;
    const ez = sx * s + sz * c;
    this.collision.addCentered(x, z, ex, ez, y0, y0 + sy);
  }

  add(object: THREE.Object3D): THREE.Object3D {
    this.root.add(object);
    return object;
  }

  animate(fn: Animator): void {
    this.animators.push(fn);
  }

  /** Register a material that the builder should dispose with the world. */
  own<T extends THREE.Material>(m: T): T {
    this.ownedMaterials.add(m);
    return m;
  }

  finalize(): THREE.Group {
    if (this.finalized) return this.root;
    this.finalized = true;
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = batch.castShadow;
      mesh.receiveShadow = batch.receiveShadow;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
      this.root.add(mesh);
    }
    this.batches.clear();
    return this.root;
  }

  /** Free GPU resources held by this world. */
  dispose(): void {
    const geos = new Set<THREE.BufferGeometry>(this.geometries.values());
    const mats = new Set<THREE.Material>(this.ownedMaterials);
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      if (mesh.material) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        list.forEach((m) => mats.add(m));
      }
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      const disposable = o as unknown as { dispose?: () => void; isReflector?: boolean };
      if (disposable.isReflector && disposable.dispose) disposable.dispose();
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
}
