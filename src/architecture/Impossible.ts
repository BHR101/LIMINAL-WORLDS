import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import { klein, mobius3d } from 'three/examples/jsm/geometries/ParametricFunctions.js';
import type { ArchBuilder } from './Builder';
import { staircase } from './Staircases';

/**
 * Impossible objects built from real geometry.
 *
 * Every figure here is a genuine 3D object that only *reads* as impossible
 * from one viewpoint (or, for the stairs, is made endless by a portal). Walk
 * away from the marked spot and you can watch the trick come apart.
 */

// ---------------------------------------------------------------- tapered bars

/** A box between two points whose square cross-section grows linearly, axes u/v. */
export function taperedBarGeometry(a: THREE.Vector3, b: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, ha: number, hb: number): THREE.BufferGeometry {
  const c = (p: THREE.Vector3, h: number, su: number, sv: number) => p.clone().addScaledVector(u, su * h).addScaledVector(v, sv * h);
  const A = [c(a, ha, -1, -1), c(a, ha, 1, -1), c(a, ha, 1, 1), c(a, ha, -1, 1)];
  const B = [c(b, hb, -1, -1), c(b, hb, 1, -1), c(b, hb, 1, 1), c(b, hb, -1, 1)];
  const quads: THREE.Vector3[][] = [
    [A[0], A[3], A[2], A[1]],
    [B[0], B[1], B[2], B[3]],
    [A[0], A[1], B[1], B[0]],
    [A[1], A[2], B[2], B[1]],
    [A[2], A[3], B[3], B[2]],
    [A[3], A[0], B[0], B[3]],
  ];
  const pos: number[] = [];
  for (const q of quads) for (const i of [0, 1, 2, 0, 2, 3]) pos.push(q[i].x, q[i].y, q[i].z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Make sure faces point outward regardless of the axis handedness.
  const center = a.clone().add(b).multiplyScalar(0.5);
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i += 3) {
    const fc = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(center);
    const fn = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
    if (fc.dot(fn) < 0) {
      for (let k = 0; k < 3; k++) n.setXYZ(i + k, -n.getX(i + k), -n.getY(i + k), -n.getZ(i + k));
      const x1 = p.getX(i + 1), y1 = p.getY(i + 1), z1 = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x1, y1, z1);
    }
  }
  return g;
}

export interface PenroseSpec {
  /** Eye position from which the triangle closes. */
  viewpoint: THREE.Vector3;
  /** Rotation of the figure about the viewpoint's vertical axis. */
  heading: number;
  distance: number;
  length: number;
  /** Vertical squash of the middle bar (>0: viewer looks up at it). */
  rise: number;
  thickness: number;
  mat: string;
}

/**
 * Penrose triangle: three mutually perpendicular bars (x, −y, z) whose
 * endpoints lie on one line through the viewpoint, so from there the far
 * start and near end overlap and the bars appear to form a closed triangle.
 * Cross-sections grow with distance so every bar looks evenly thick.
 */
export function penroseTriangle(b: ArchBuilder, s: PenroseSpec): { origin: THREE.Vector3; center: THREE.Vector3 } {
  const L = s.length;
  const dir = new THREE.Vector3(1, -s.rise, 1);
  const n = dir.length();
  const local = (p: THREE.Vector3) => p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s.heading).add(s.viewpoint);
  // Local frame: viewpoint at 0; O = −D·dir/n.
  const O = dir.clone().multiplyScalar(-s.distance / n);
  const A = O.clone().add(new THREE.Vector3(L, 0, 0));
  const B = A.clone().add(new THREE.Vector3(0, -s.rise * L, 0));
  const E = B.clone().add(new THREE.Vector3(0, 0, L));
  const size = (p: THREE.Vector3) => (s.thickness / 2) * (p.length() / s.distance);
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const ext = (p: THREE.Vector3, axis: THREE.Vector3, sign: number) => p.clone().addScaledVector(axis, sign * size(p));
  const bars: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
    [ext(O, X, -1), ext(A, X, 1), Y, Z, X],
    [ext(A, Y, 1), ext(B, Y, -1), X, Z, Y],
    [ext(B, Z, -1), ext(E, Z, 1), X, Y, Z],
  ];
  const geos = bars.map(([p0, p1, u, v]) => {
    const g = taperedBarGeometry(local(p0), local(p1), u.clone().applyAxisAngle(Y, s.heading), v.clone().applyAxisAngle(Y, s.heading), size(p0), size(p1));
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), b.mat(s.mat));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  b.add(mesh);
  geos.forEach((g) => g.dispose());
  const center = local(O.clone().add(A).add(B).multiplyScalar(1 / 3));
  return { origin: local(O), center };
}

// ---------------------------------------------------------------- Penrose stairs

export interface PenroseStairsSpec {
  start: THREE.Vector3;
  width: number;
  longSteps: number;
  shortSteps: number;
  mat: string;
  landingMat: string;
}

/** Offset from the start landing to the end landing for the given flights. */
export function penroseOffset(longSteps: number, shortSteps: number): THREE.Vector3 {
  const run = 0.6 * (longSteps - shortSteps);
  return new THREE.Vector3(run, 0.5 * (longSteps + shortSteps), run);
}

export interface PenroseStairsResult {
  /** Vector from the start landing to the end landing (end appears to coincide with start). */
  offset: THREE.Vector3;
  end: THREE.Vector3;
  /** Portal at the end landing's +X edge, leading to the start landing's +X edge. */
  portal: { position: THREE.Vector3; target: THREE.Vector3; width: number; height: number };
  landings: THREE.Vector3[];
}

/**
 * Ascending and descending: four flights that all go up. Two long flights
 * (+X, +Z) and two short ones (−X, −Z) leave the end landing displaced from
 * the start by D; viewed along D the two landings coincide. A translation
 * portal at the end lets you climb it forever.
 */
export function penroseStairs(b: ArchBuilder, s: PenroseStairsSpec): PenroseStairsResult {
  const w = s.width;
  const rise = 0.25;
  const tread = 0.6;
  const L0 = s.start.clone();
  const landing = (p: THREE.Vector3) => b.box(p.x, p.y - 1.2, p.z, w, 1.2, w, s.landingMat);
  landing(L0);
  const longRun = s.longSteps * tread;
  const shortRun = s.shortSteps * tread;
  // Flight 1: +X
  staircase(b, { x: L0.x + w / 2, z: L0.z, y0: L0.y, facing: 1, width: w, steps: s.longSteps, rise, tread, mat: s.mat, slab: 0.6 });
  const L1 = new THREE.Vector3(L0.x + w + longRun, L0.y + s.longSteps * rise, L0.z);
  landing(L1);
  // Flight 2: +Z
  staircase(b, { x: L1.x, z: L1.z + w / 2, y0: L1.y, facing: 2, width: w, steps: s.longSteps, rise, tread, mat: s.mat, slab: 0.6 });
  const L2 = new THREE.Vector3(L1.x, L1.y + s.longSteps * rise, L1.z + w + longRun);
  landing(L2);
  // Flight 3: −X
  staircase(b, { x: L2.x - w / 2, z: L2.z, y0: L2.y, facing: 3, width: w, steps: s.shortSteps, rise, tread, mat: s.mat, slab: 0.6 });
  const L3 = new THREE.Vector3(L2.x - w - shortRun, L2.y + s.shortSteps * rise, L2.z);
  landing(L3);
  // Flight 4: −Z
  staircase(b, { x: L3.x, z: L3.z - w / 2, y0: L3.y, facing: 0, width: w, steps: s.shortSteps, rise, tread, mat: s.mat, slab: 0.6 });
  const L4 = new THREE.Vector3(L3.x, L3.y + s.shortSteps * rise, L3.z - w - shortRun);
  landing(L4);
  // Low walls on the outer edges, Escher-style.
  const wall = (x: number, z: number, y: number, sx: number, sz: number) => b.box(x, y, z, sx, 0.7, sz, s.landingMat);
  wall(L1.x + w / 2 + 0.15, L1.z, L1.y, 0.3, w);
  wall(L2.x + w / 2 + 0.15, L2.z, L2.y, 0.3, w);
  wall(L2.x, L2.z + w / 2 + 0.15, L2.y, w, 0.3);
  wall(L0.x, L0.z - w / 2 - 0.15, L0.y, w, 0.3);
  wall(L4.x - w / 2 - 0.15, L4.z, L4.y, 0.3, w);
  const offset = L4.clone().sub(L0);
  return {
    offset,
    end: L4,
    landings: [L0, L1, L2, L3, L4],
    portal: {
      position: new THREE.Vector3(L4.x + w / 2 + 0.02, L4.y + 1.6, L4.z),
      target: new THREE.Vector3(L0.x + w / 2 + 0.02, L0.y + 1.6, L0.z),
      width: w,
      height: 3.2,
    },
  };
}

// ---------------------------------------------------------------- Ames room

/**
 * A projective transform that fixes the viewpoint V and every ray through it,
 * but pushes the left side away and pulls the right side in. Planes stay
 * planes, so a rectangular room built "as seen" becomes a real trapezoid that
 * looks perfectly rectangular from V — and makes identical figures look like
 * giants and dwarfs.
 */
export function amesMap(V: THREE.Vector3, c: number): (p: THREE.Vector3) => THREE.Vector3 {
  return (p) => {
    const q = p.clone().sub(V);
    return q.multiplyScalar(1 / (1 + c * q.x)).add(V);
  };
}

export function mapGeometry(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => THREE.Vector3, source?: THREE.BufferAttribute): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const src = source ?? pos;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(src.getX(i), src.getY(i), src.getZ(i));
    const m = f(v);
    pos.setXYZ(i, m.x, m.y, m.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

export interface AmesSpec {
  viewpoint: THREE.Vector3;
  width: number;
  depth: number;
  height: number;
  strength: number;
  mats: { floorA: string; floorB: string; wall: string; trim: string; figure: string };
}

/** Builds an Ames room in front of (−Z from) the viewpoint. Returns an animator for the walking figure. */
export function amesRoom(b: ArchBuilder, s: AmesSpec): { update: (t: number) => void } {
  const V = s.viewpoint;
  const f = amesMap(V, s.strength);
  const W = s.width;
  const D = s.depth;
  const H = s.height;
  const z0 = V.z - 0.4; // front wall plane (apparent)
  const floorY = V.y - 1.65;
  const byMat = new Map<string, THREE.BufferGeometry[]>();
  const piece = (mat: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x, y + sy / 2, z);
    mapGeometry(g, f);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(g);
  };
  // Checkerboard floor (the strongest cue for "this room is rectangular").
  const n = 8;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const x = V.x - W / 2 + (i + 0.5) * (W / n);
      const z = z0 - (k + 0.5) * (D / n);
      piece((i + k) % 2 ? s.mats.floorA : s.mats.floorB, x, floorY - 0.2, z, W / n, 0.2, D / n);
      // Collider: mapped tile footprint, top at the mapped height.
      const c = f(new THREE.Vector3(x, floorY, z));
      const a = f(new THREE.Vector3(x - W / n / 2, floorY, z - D / n / 2));
      const e = f(new THREE.Vector3(x + W / n / 2, floorY, z + D / n / 2));
      b.collision.addBox(Math.min(a.x, e.x), c.y - 0.6, Math.min(a.z, e.z), Math.max(a.x, e.x), c.y, Math.max(a.z, e.z));
    }
  }
  // Walls, ceiling, window frames.
  piece(s.mats.wall, V.x, floorY, z0 - D - 0.15, W + 0.6, H, 0.3); // back
  piece(s.mats.wall, V.x - W / 2 - 0.15, floorY, z0 - D / 2, 0.3, H, D); // left
  piece(s.mats.wall, V.x + W / 2 + 0.15, floorY, z0 - D / 2, 0.3, H, D); // right
  piece(s.mats.wall, V.x, floorY + H, z0 - D / 2, W + 0.6, 0.3, D + 0.3); // ceiling
  // Front wall with a peephole at eye height and a door on the right.
  const fw = (x: number, y: number, sx: number, sy: number) => piece(s.mats.wall, x, y, z0 + 0.15, sx, sy, 0.3);
  fw(V.x - W / 4 - 0.1, floorY, W / 2 - 0.2, H); // left of peephole
  fw(V.x + (0.2 + W / 2 - 1.2) / 2, floorY, W / 2 - 1.4, H); // between peephole and door
  fw(V.x, floorY, 0.4, 1.45); // below peephole
  fw(V.x, floorY + 1.85, 0.4, H - 1.85); // above peephole
  fw(V.x + W / 2 - 0.6, floorY + 2.4, 1.2, H - 2.4); // above door
  for (const wx of [-W / 4, W / 4]) {
    piece(s.mats.trim, V.x + wx, floorY + 1.2, z0 - D + 0.02, 1.6, 0.12, 0.1);
    piece(s.mats.trim, V.x + wx, floorY + 2.6, z0 - D + 0.02, 1.6, 0.12, 0.1);
    piece(s.mats.trim, V.x + wx - 0.8, floorY + 1.2, z0 - D + 0.02, 0.12, 1.5, 0.1);
    piece(s.mats.trim, V.x + wx + 0.8, floorY + 1.2, z0 - D + 0.02, 0.12, 1.5, 0.1);
  }
  // Two identical, undistorted figures standing in the back corners.
  const figureGeo = () => {
    const body = new THREE.BoxGeometry(0.5, 1.3, 0.35).toNonIndexed().translate(0, 0.65, 0);
    const head = new THREE.BoxGeometry(0.32, 0.36, 0.32).toNonIndexed().translate(0, 1.53, 0);
    return mergeGeometries([body, head]);
  };
  for (const fx of [V.x - W / 2 + 0.8, V.x + W / 2 - 0.8]) {
    const foot = f(new THREE.Vector3(fx, floorY, z0 - D + 0.8));
    const g = figureGeo().translate(foot.x, foot.y, foot.z);
    if (!byMat.has(s.mats.figure)) byMat.set(s.mats.figure, []);
    byMat.get(s.mats.figure)!.push(g);
  }
  for (const [mat, list] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(list), b.mat(mat));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    b.add(mesh);
    list.forEach((g) => g.dispose());
  }
  // Wall colliders: chains of small boxes along the mapped wall bases.
  const chain = (p0: THREE.Vector3, p1: THREE.Vector3) => {
    const a = f(p0);
    const e = f(p1);
    const steps = Math.ceil(a.distanceTo(e) / 0.5);
    for (let i = 0; i <= steps; i++) {
      const p = a.clone().lerp(e, i / steps);
      b.collision.addCentered(p.x, p.z, 0.4, 0.4, p.y - 1, p.y + 4);
    }
  };
  const fl = (x: number, z: number) => new THREE.Vector3(x, floorY, z);
  chain(fl(V.x - W / 2, z0), fl(V.x - W / 2, z0 - D));
  chain(fl(V.x + W / 2, z0), fl(V.x + W / 2, z0 - D));
  chain(fl(V.x - W / 2, z0 - D), fl(V.x + W / 2, z0 - D));
  chain(fl(V.x - W / 2, z0), fl(V.x + W / 2 - 1.3, z0));

  // A third, identical figure walks along the back wall — and seems to grow and shrink.
  const walker = new THREE.Mesh(figureGeo(), b.mat(s.mats.trim));
  walker.castShadow = true;
  b.add(walker);
  const apparent = new THREE.Vector3();
  return {
    update: (t: number) => {
      const u = 0.5 - 0.5 * Math.cos(t * 0.35);
      apparent.set(V.x - W / 2 + 1.6 + u * (W - 3.2), floorY, z0 - D + 2.2);
      walker.position.copy(f(apparent));
    },
  };
}

// ---------------------------------------------------------------- tesseract

/** A 4D hypercube, rotated in planes that involve the fourth axis and projected into 3D. */
export function tesseract(b: ArchBuilder, center: THREE.Vector3, size: number, edgeMat: string, nodeMat: string): { update: (t: number, speed: number) => void } {
  const verts: number[][] = [];
  for (let i = 0; i < 16; i++) verts.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) if (!(i & (1 << k))) edges.push([i, i | (1 << k)]);
  const edgeGeo = b.geometry('tess-edge', () => new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0));
  const nodeGeo = b.geometry('tess-node', () => new THREE.IcosahedronGeometry(1, 1));
  const edgeMesh = new THREE.InstancedMesh(edgeGeo, b.mat(edgeMat), edges.length);
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, b.mat(nodeMat), 16);
  edgeMesh.frustumCulled = nodeMesh.frustumCulled = false;
  edgeMesh.castShadow = true;
  b.add(edgeMesh);
  b.add(nodeMesh);
  const p3 = verts.map(() => new THREE.Vector3());
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  let phase = 0;
  return {
    update: (dt: number, speed: number) => {
      phase += dt * speed;
      const a = phase * 0.5;
      const c = phase * 0.31;
      verts.forEach(([x0, y0, z0, w0], i) => {
        // Rotate in the XW and ZW planes, then a little in XY.
        let x = x0 * Math.cos(a) - w0 * Math.sin(a);
        let w = x0 * Math.sin(a) + w0 * Math.cos(a);
        const z = z0 * Math.cos(c) - w * Math.sin(c);
        w = z0 * Math.sin(c) + w * Math.cos(c);
        const y = y0 * Math.cos(a * 0.4) - x * Math.sin(a * 0.4);
        x = y0 * Math.sin(a * 0.4) + x * Math.cos(a * 0.4);
        const k = 2.6 / (3.2 - w);
        p3[i].set(x * k, y * k, z * k).multiplyScalar(size).add(center);
        const r = 0.09 * size * k;
        m.compose(p3[i], q.identity(), new THREE.Vector3(r, r, r));
        nodeMesh.setMatrixAt(i, m);
      });
      edges.forEach(([i, j], e) => {
        dir.subVectors(p3[j], p3[i]);
        const len = dir.length();
        q.setFromUnitVectors(up, dir.normalize());
        m.compose(p3[i], q, new THREE.Vector3(0.035 * size, len, 0.035 * size));
        edgeMesh.setMatrixAt(e, m);
      });
      edgeMesh.instanceMatrix.needsUpdate = true;
      nodeMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- non-orientable surfaces

export function kleinBottle(b: ArchBuilder, position: THREE.Vector3, scale: number, mat: string): THREE.Mesh {
  const geo = new ParametricGeometry(klein, 90, 36);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, b.mat(mat));
  mesh.scale.setScalar(scale / 12);
  mesh.position.copy(position);
  mesh.castShadow = true;
  b.add(mesh);
  return mesh;
}

export function mobiusStrip(b: ArchBuilder, position: THREE.Vector3, scale: number, mat: string): THREE.Mesh {
  const geo = new ParametricGeometry(mobius3d, 120, 12);
  const mesh = new THREE.Mesh(geo, b.mat(mat));
  mesh.scale.setScalar(scale);
  mesh.position.copy(position);
  mesh.castShadow = true;
  b.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- hyperbolic floor

/**
 * The {7,3} tiling of the hyperbolic plane in the Poincaré disk: every heptagon
 * is the same size in hyperbolic geometry, yet they shrink without end toward
 * the rim. A slow hyperbolic translation makes the tiles flow outward forever.
 */
export function hyperbolicFloorMaterial(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, line: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(a) },
        uB: { value: new THREE.Color(b) },
        uLine: { value: new THREE.Color(line) },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv * 2.0 - 1.0;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #define P 7.0
      #define Q 3.0
      uniform float uTime;
      uniform vec3 uA, uB, uLine;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
      vec2 cdiv(vec2 a, vec2 b) { return cmul(a, vec2(b.x, -b.y)) / dot(b, b); }
      void main() {
        vec2 z = vUv;
        float rr = dot(z, z);
        if (rr > 1.0) discard;
        // Hyperbolic translation (a Möbius map of the disk) drifting over time.
        vec2 m = 0.55 * vec2(cos(uTime * 0.05), sin(uTime * 0.05)) * sin(uTime * 0.13);
        z = cdiv(z + m, vec2(1.0, 0.0) + cmul(vec2(m.x, -m.y), z));
        float a = PI / P;
        float bb = PI / Q;
        float den = sqrt(cos(bb) * cos(bb) - sin(a) * sin(a));
        vec2 C = vec2(cos(bb) / den, 0.0);
        float r = sin(a) / den;
        vec2 nrm = vec2(-sin(a), cos(a));
        float parity = 0.0;
        for (int i = 0; i < 60; i++) {
          bool done = true;
          if (z.y < 0.0) { z.y = -z.y; parity += 1.0; done = false; }
          float d = dot(z, nrm);
          if (d > 0.0) { z -= 2.0 * d * nrm; parity += 1.0; done = false; }
          vec2 w = z - C;
          float l2 = dot(w, w);
          if (l2 < r * r) { z = C + w * (r * r / l2); parity += 1.0; done = false; }
          if (done) break;
        }
        // Edge of the heptagon = the circle mirror; draw it as a thin line.
        float edge = abs(length(z - C) - r);
        float scale = (1.0 - rr);
        float lw = 0.012 + fwidth(edge) * 1.5;
        float line = 1.0 - smoothstep(lw * 0.5, lw, edge);
        vec3 col = mod(parity, 2.0) < 1.0 ? uA : uB;
        col = mix(col, uLine, line);
        // Beyond resolvable detail near the rim, settle to the average tone.
        col = mix(col, (uA + uB) * 0.5, smoothstep(0.0, 0.02, fwidth(vUv.x) / max(scale, 1e-3) * 0.25));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
}
