import * as THREE from 'three';
import { RNG } from '../core/rng';
import { arch, arcade } from '../architecture/Arches';
import { pillar } from '../architecture/Pillars';
import { staircase } from '../architecture/Staircases';
import { platform, room, ring, sculpture, wallWithOpenings } from '../architecture/Structures';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { createCloudLayer, createLightShaft } from '../rendering/Effects';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { ArchBuilder } from '../architecture/Builder';
import type { PortalDef } from '../architecture/Portals';
import type { WorldDefinition } from './types';

const HALL_Z = -1000; // interior hallway, far from the little house that contains it
const TURNED = v3(0, 0, -1400);
const CELLAR = v3(0, -300, -1000);
const NAVE = v3(0, 0, -2000);
const VISTA = v3(-20, 0, -4000);

function furnitureSet(b: ArchBuilder, x: number, z: number, rotY: number): void {
  // A chair and table, built from boxes, rotated in place.
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const at = (lx: number, lz: number) => [x + lx * c + lz * s, z - lx * s + lz * c] as const;
  const [tx, tz] = at(0, 0);
  b.box(tx, 0.72, tz, 1.6, 0.06, 0.9, 'wood', { rotY, collide: false });
  for (const [lx, lz] of [[-0.7, -0.38], [0.7, -0.38], [-0.7, 0.38], [0.7, 0.38]]) {
    const [px, pz] = at(lx, lz);
    b.box(px, 0, pz, 0.06, 0.72, 0.06, 'wood', { rotY, collide: false });
  }
  b.collideBox(tx, 0, tz, 1.6, 0.78, 0.9, rotY);
  const [cx, cz] = at(0, 0.9);
  b.box(cx, 0.42, cz, 0.5, 0.06, 0.5, 'rose', { rotY, collide: false });
  const [bx, bz] = at(0, 1.13);
  b.box(bx, 0.42, bz, 0.5, 0.6, 0.06, 'rose', { rotY, collide: false });
}

export const ImpossibleHouse: WorldDefinition = {
  id: 'impossible-house',
  numeral: 'VII',
  name: 'The Impossible House',
  tagline: 'A modest house with an immodest interior.',
  description:
    'A small house on a floating lawn at dusk. Its hallway is longer than the house, its rooms disagree about which way is down, and one window looks onto somewhere else entirely.',
  build(ctx) {
    const rng = new RNG(ctx.seed || 404);
    const sunDir = v3(-0.93, 0.2, -0.3).normalize();
    const kit = beginWorld(
      ctx,
      {
        ivory: createArchMaterial({ color: 0xe6dccb, roughness: 0.9, variation: 0.2, scale: 0.4, streaks: 0.05 }),
        beige: createArchMaterial({ color: 0xc8b49a, roughness: 0.85, variation: 0.35, panel: 1.1 }),
        rose: createArchMaterial({ color: 0xbf8f8f, roughness: 0.8, variation: 0.3, scale: 0.5 }),
        wood: createArchMaterial({ color: 0x8a6a50, roughness: 0.55, variation: 0.6, scale: 0.9, streaks: 0 }),
        stone: createArchMaterial({ color: 0xd2bfae, roughness: 0.85, variation: 0.4, panel: 1.6 }),
        brick: createArchMaterial({ color: 0x7c5a52, roughness: 0.95, variation: 0.6, panel: 0.3, streaks: 0.2 }),
        lawn: createArchMaterial({ color: 0x6f7a5c, roughness: 1, variation: 0.7, scale: 0.5, streaks: 0 }),
        roof: createArchMaterial({ color: 0x5b4a4c, roughness: 0.8, variation: 0.4, panel: 0.4 }),
        dark: createArchMaterial({ color: 0x2a2224, roughness: 0.6, variation: 0.2 }),
        glow: createGlowMaterial(0xffc890, 3.2, 0.1, 0.4),
        glowSoft: createGlowMaterial(0xffc58f, 0.85, 0.05, 0.3),
      },
      {
        sky: {
          top: 0x34304b,
          horizon: 0xe3b2a2,
          bottom: 0x8f7584,
          sunDirection: sunDir,
          sunColor: 0xffcf9e,
          sunSize: 0.0014,
          sunGlow: 1.4,
          clouds: 0.45,
          cloudColor: 0xffc7a8,
          cloudShadow: 0x7d6577,
        },
        fogDensity: 0.0032,
        sunIntensity: 3,
        hemiSky: 0xd8c0bd,
        hemiGround: 0x3a2e30,
        hemiIntensity: 0.32,
        environmentIntensity: 0.32,
        exposure: 1.0,
        bloom: 0.35,
        shadowRange: 60,
        vignette: 0.5,
      },
    );
    const { b } = kit;
    // Few real lights (each costs every pixel); the rest are glowing fixtures only.
    const lamp = (x: number, y: number, z: number, intensity = 7, distance = 14) => {
      if (intensity > 0) {
        const l = new THREE.PointLight(0xffc690, intensity, distance, 1.6);
        l.position.set(x, y, z);
        b.add(l);
      }
      b.box(x, y + 0.05, z, 0.35, 0.12, 0.35, 'glow', { collide: false, castShadow: false });
    };

    b.add(createCloudLayer({ y: -25, lit: 0xffc4a2, shadow: 0x7c6a86, horizon: 0xe3b2a2, sunDirection: sunDir, cover: 0.4, scale: 0.005, wind: 0.6, octaves: ctx.quality.cloudOctaves }));

    // --- The island and the little house -----------------------------------------
    platform(b, { x: 0, y: 0, z: 2, width: 44, depth: 44, thickness: 3, mat: 'lawn', keel: 34 });
    b.box(0, -0.2, 2, 44.4, 0.3, 44.4, 'stone', { collide: false });
    for (let z = -1; z < 22; z += 1.6) b.box(0, 0, z, 1.4, 0.04, 1.1, 'stone', { collide: false });
    // Hedges along the edges stop wandering off the lawn.
    b.box(-21.5, 0, 2, 1, 1.1, 43, 'lawn');
    b.box(21.5, 0, 2, 1, 1.1, 43, 'lawn');
    b.box(0, 0, -19.5, 43, 1.1, 1, 'lawn');
    b.box(-12.5, 0, 23.5, 19, 1.1, 1, 'lawn');
    b.box(12.5, 0, 23.5, 19, 1.1, 1, 'lawn');
    // Exterior shell: 10 m × 8 m. The hallway inside it is 30 m long.
    wallWithOpenings(b, 0, 0, -2.25, 10, 5.6, 0.5, true, [
      { side: 's', offset: -3, width: 1.2, height: 1.3, sill: 1.1 },
      { side: 's', offset: 0, width: 1.2, height: 2.3 },
      { side: 's', offset: 3, width: 1.2, height: 1.3, sill: 1.1 },
    ], 'ivory');
    b.box(-3, 1.1, -2.4, 1.2, 1.3, 0.1, 'glowSoft', { collide: false });
    b.box(3, 1.1, -2.4, 1.2, 1.3, 0.1, 'glowSoft', { collide: false });
    b.box(0, 0, -10.25, 10, 5.6, 0.5, 'ivory');
    b.box(-5.25, 0, -6.25, 0.5, 5.6, 8.5, 'ivory');
    b.box(5.25, 0, -6.25, 0.5, 5.6, 8.5, 'ivory');
    b.box(0, 0, -6.25, 10, 0.4, 8, 'wood', { collide: false });
    // Pitched roof: two slabs meeting at a ridge along X, with triangular gables.
    const pitch = Math.atan2(2.4, 4);
    const slope = Math.hypot(4, 2.4) + 0.6;
    for (const k of [-1, 1]) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(k * pitch, 0, 0));
      b.box(0, 6.8 - 0.15, -6.25 + k * 2.05, 11.2, 0.3, slope, 'roof', { quaternion: q, collide: false });
    }
    const gable = b.geometry('gable', () => {
      const shape = new THREE.Shape([new THREE.Vector2(-4, 0), new THREE.Vector2(4, 0), new THREE.Vector2(0, 2.4)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
      g.translate(0, 0, -0.25);
      g.rotateY(Math.PI / 2);
      return g;
    });
    for (const x of [-5.25, 5.25]) b.instance(gable, 'ivory', new THREE.Matrix4().makeTranslation(x, 5.6, -6.25));
    b.box(2.6, 6.0, -7.4, 0.8, 3.0, 0.8, 'brick', { collide: false });
    b.box(0, 2.3, -1.9, 1.6, 0.2, 0.3, 'rose', { collide: false });
    lamp(0, 2.75, -1.4, 0);
    for (const x of [-14, 14]) pillar(b, { x, z: 14, y0: 0, height: 2.6, size: 0.12, style: 'round', mat: 'dark' });
    for (const x of [-14, 14]) b.box(x, 2.6, 14, 0.3, 0.3, 0.3, 'glow', { collide: false, castShadow: false });
    // Garden gate (a passage back to the nave).
    arch(b, { x: 0, z: 23.5, y0: 0, span: 2.4, legHeight: 2.6, pier: 0.6, depth: 0.6, crown: 0.4, mat: 'stone' });

    // --- Hallway ----------------------------------------------------------------
    const H = { z0: HALL_Z, len: 30 };
    const hz = H.z0 - H.len / 2;
    b.box(0, -0.5, hz, 3.4, 0.5, H.len + 0.8, 'wood');
    b.box(0, 3.2, hz, 3.8, 0.4, H.len + 0.8, 'ivory');
    b.box(0, 0.001, hz, 1.4, 0.01, H.len - 1, 'rose', { collide: false, castShadow: false });
    wallWithOpenings(b, 1.7, 0, hz, H.len, 3.2, 0.4, false, [
      { side: 'e', offset: -10, width: 1.2, height: 1.4, sill: 1 },
      { side: 'e', offset: -5, width: 1.2, height: 1.4, sill: 1 },
      { side: 'e', offset: 7, width: 1.2, height: 2.3 },
    ], 'ivory');
    wallWithOpenings(b, -1.7, 0, hz, H.len, 3.2, 0.4, false, [
      { side: 'w', offset: -5, width: 2.4, height: 3.0 },
      { side: 'w', offset: 7, width: 1.2, height: 2.3 },
    ], 'ivory');
    wallWithOpenings(b, 0, 0, H.z0 + 0.2, 3.8, 3.2, 0.4, true, [{ side: 'n', width: 1.2, height: 2.3 }], 'ivory');
    wallWithOpenings(b, 0, 0, H.z0 - H.len - 0.2, 3.8, 3.2, 0.4, true, [{ side: 's', width: 1.1, height: 2.2 }], 'ivory');
    for (const side of [-1, 1]) b.box(side * 1.48, 0, hz, 0.04, 0.16, H.len, 'rose', { collide: false, castShadow: false });
    for (let i = 0; i < 5; i++) b.box(-1.47, 1.3, H.z0 - 3 - i * 5.2, 0.05, 0.9, 0.7, 'dark', { collide: false, castShadow: false });
    b.box(0, 2.25, H.z0 - H.len + 0.02, 1.5, 0.12, 0.1, 'rose', { collide: false });
    lamp(0, 2.95, H.z0 - 8, 0);
    lamp(0, 2.95, H.z0 - 15, 7, 18);
    lamp(0, 2.95, H.z0 - 22, 0);

    // Parlour (east), with the door to the turned room.
    room(b, {
      x: 5.9, z: H.z0 - 8, y0: 0, width: 8, depth: 8, height: 3.2, wall: 0.4, mat: 'ivory', floorMat: 'wood', ceilingMat: 'ivory', omit: ['w'],
      openings: [
        { side: 'e', width: 1.1, height: 2.2 },
        { side: 's', width: 2, height: 1.4, sill: 0.9 },
      ],
    });
    b.box(5.9, 0, H.z0 - 11.6, 2.4, 1.2, 0.6, 'brick');
    b.box(5.9, 0.2, H.z0 - 11.3, 1.2, 0.4, 0.05, 'glow', { collide: false });
    b.box(4.2, 0, H.z0 - 6, 2.6, 0.45, 0.9, 'rose');
    b.box(4.2, 0.45, H.z0 - 5.6, 2.6, 0.5, 0.2, 'rose', { collide: false });
    b.box(9.84, 2.2, H.z0 - 8, 0.06, 0.12, 1.4, 'rose', { collide: false });
    lamp(6.5, 2.95, H.z0 - 8, 5, 10);

    // Study (west), with the window that is too wide.
    room(b, {
      x: -5.9, z: H.z0 - 8, y0: 0, width: 8, depth: 8, height: 3.2, wall: 0.4, mat: 'beige', floorMat: 'wood', ceilingMat: 'ivory', omit: ['e'],
      openings: [
        { side: 'w', width: 1.2, height: 1.0, sill: 1.0 },
        { side: 's', width: 2, height: 1.4, sill: 0.9 },
      ],
    });
    furnitureSet(b, -5.5, H.z0 - 9.5, 0.2);
    for (let i = 0; i < 3; i++) b.box(-9.6, 0, H.z0 - 4.8 - i * 1.1, 0.5, 2.6, 1, 'wood');
    // A modest frame around a window that is not modest at all.
    for (const dz of [-0.68, 0.68]) b.box(-9.84, 0.92, H.z0 - 8 + dz, 0.1, 1.16, 0.12, 'rose', { collide: false });
    for (const y of [0.92, 2.0]) b.box(-9.84, y, H.z0 - 8, 0.1, 0.08, 1.48, 'rose', { collide: false });
    lamp(-5.9, 2.95, H.z0 - 8, 5, 10);

    // Stairwell (west): the stair up to the "attic".
    room(b, { x: -5.9, z: H.z0 - 20, y0: 0, width: 8, depth: 6, height: 6.6, wall: 0.4, mat: 'beige', floorMat: 'wood', ceilingMat: 'ivory', omit: ['e'], openings: [{ side: 'w', width: 1.1, height: 2.2, sill: 3 }] });
    b.box(-1.7, 3.2, H.z0 - 20, 0.4, 3.4, 6.8, 'beige');
    staircase(b, { x: -2.3, z: H.z0 - 20, y0: 0, facing: 3, width: 2, steps: 12, rise: 0.25, tread: 0.5, mat: 'wood', solid: true });
    b.box(-9.1, 0, H.z0 - 20, 1.6, 3, 2.4, 'wood');
    b.box(-5.9, 0, H.z0 - 21.4, 6, 3.4, 0.2, 'rose', { collide: false });
    lamp(-6, 6.3, H.z0 - 20, 0);

    // --- The turned room ------------------------------------------------------------
    room(b, {
      x: TURNED.x, z: TURNED.z, y0: 0, width: 6, depth: 7, height: 3.4, wall: 0.4, mat: 'rose', floorMat: 'wood', ceilingMat: 'ivory',
      openings: [
        { side: 'w', offset: 1.6, width: 1.1, height: 2.2 },
        { side: 'e', offset: -1.6, width: 1.4, height: 1.5, sill: 0.9 },
        { side: 's', width: 1.6, height: 1.4, sill: 0.9 },
      ],
    });
    // Cues that make the 90° turn legible from the parlour: a window, a hanging lamp, a painting.
    b.box(TURNED.x + 2.9, 0.86, TURNED.z - 1.6, 0.2, 0.08, 1.6, 'wood', { collide: false });
    b.box(TURNED.x + 2.95, 1.0, TURNED.z + 1.4, 0.06, 1.1, 1.5, 'wood', { collide: false });
    b.box(TURNED.x + 2.9, 1.1, TURNED.z + 1.4, 0.06, 0.9, 1.3, 'glowSoft', { collide: false });
    b.box(TURNED.x + 1.2, 2.2, TURNED.z - 1.6, 0.03, 1.2, 0.03, 'dark', { collide: false, castShadow: false });
    b.box(TURNED.x + 1.2, 1.9, TURNED.z - 1.6, 0.5, 0.3, 0.5, 'glow', { collide: false });
    for (let i = 0; i < 4; i++) b.box(TURNED.x - 2.2 + i * 1.5, 0, TURNED.z - 3.25, 1.3, 3, 0.5, 'wood');
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) b.box(TURNED.x - 2.2 + i * 1.5, 0.4 + k * 0.7, TURNED.z - 3.1, 1.1, 0.45, 0.25, rng.chance(0.5) ? 'rose' : 'beige', { collide: false, castShadow: false });
    furnitureSet(b, TURNED.x + 0.6, TURNED.z + 0.3, Math.PI / 2);
    b.box(TURNED.x - 2.98, 0, TURNED.z - 1.6, 0.06, 2.2, 1.1, 'wood', { collide: false });
    lamp(TURNED.x, 3.15, TURNED.z, 6, 10);

    // --- The cellar ------------------------------------------------------------------
    room(b, { x: CELLAR.x, z: CELLAR.z, y0: CELLAR.y, width: 8, depth: 12, height: 3.8, wall: 0.5, mat: 'brick', floorMat: 'stone', ceilingMat: 'brick', openings: [{ side: 'n', width: 1.1, height: 2.2, sill: 1.25 }] });
    staircase(b, { x: CELLAR.x, z: CELLAR.z - 3.5, y0: CELLAR.y, facing: 0, width: 1.6, steps: 5, rise: 0.25, tread: 0.5, mat: 'stone', solid: true });
    for (let i = 0; i < 6; i++) b.box(CELLAR.x + (i % 2 ? 3.2 : -3.2), CELLAR.y, CELLAR.z + 4 - i * 1.4, 0.8, rng.range(0.6, 1.4), 0.8, 'wood');
    b.box(CELLAR.x + 3.95, CELLAR.y, CELLAR.z, 0.08, 2.2, 1.1, 'wood', { collide: false });
    lamp(CELLAR.x, CELLAR.y + 3.5, CELLAR.z + 1, 6, 12);

    // --- The door to the nave: a hall far too large for any house -------------------
    const N = { x: NAVE.x, z: NAVE.z, w: 70, d: 140, h: 55 };
    const south = N.z + N.d / 2;
    b.box(N.x, -0.5, N.z, N.w + 2, 0.5, N.d + 2, 'stone');
    for (const side of [-1, 1]) {
      const openings = [] as { side: 'e' | 'w'; offset: number; width: number; height: number; sill: number }[];
      for (let k = -4; k <= 4; k++) openings.push({ side: side > 0 ? 'e' : 'w', offset: k * 14, width: 4, height: 26, sill: 8 });
      wallWithOpenings(b, N.x + side * (N.w / 2 + 1), 0, N.z, N.d, N.h, 2, false, openings, 'ivory');
    }
    wallWithOpenings(b, N.x, 0, south + 1, N.w + 4, N.h, 2, true, [{ side: 's', width: 1.1, height: 2.2 }], 'ivory');
    b.box(N.x, 0, N.z - N.d / 2 - 1, N.w + 4, N.h, 2, 'ivory');
    b.box(N.x, N.h, N.z, N.w + 4, 2, N.d + 4, 'ivory', { collide: false });
    for (let z = -N.d / 2 + 10; z < N.d / 2; z += 14) for (const sx of [-18, 18]) pillar(b, { x: N.x + sx, z: N.z + z, y0: 0, height: N.h - 3, size: 1.6, style: 'fluted', mat: 'beige', base: true, capital: true });
    for (let z = -N.d / 2; z <= N.d / 2; z += 7) b.box(N.x, N.h - 3, N.z + z, N.w, 3, 1, 'beige', { collide: false, castShadow: false });
    b.box(N.x, 0, N.z, 8, 0.02, N.d - 8, 'rose', { collide: false, castShadow: false });
    // Floating furniture and a room hanging sideways in the air.
    for (let i = 0; i < 9; i++) {
      const p = v3(N.x + rng.range(-14, 14), rng.range(6, 30), N.z + rng.range(-50, 40));
      const g = sculpture(b, { position: p, size: rng.range(0.8, 1.6), kind: rng.pick(['cube', 'tetrahedron', 'octahedron'] as const), mat: rng.pick(['wood', 'rose', 'beige']), float: 0.8, spin: rng.range(0.03, 0.1) });
      g.rotation.set(rng.range(0, 3), 0, rng.range(0, 3));
    }
    const hung = new THREE.Group();
    hung.position.set(N.x, 24, N.z - 20);
    hung.rotation.set(0.4, 0.3, Math.PI / 2);
    const pieces: [number, number, number, number, number, number, string][] = [
      [0, -0.2, 0, 6, 0.4, 6, 'wood'], [0, 1.6, -3, 6, 3.6, 0.3, 'rose'], [-3, 1.6, 0, 0.3, 3.6, 6, 'rose'], [0, 0.4, 0, 1.6, 0.06, 0.9, 'wood'], [1.8, 1.2, -2.6, 1.2, 2.4, 0.5, 'wood'],
    ];
    for (const [x, y, z, sx, sy, sz, m] of pieces) {
      const mesh = new THREE.Mesh(b.unitBox, b.mat(m));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      hung.add(mesh);
    }
    b.add(hung);
    kit.onUpdate.push((dt) => (hung.rotation.y += dt * 0.03));
    staircase(b, { x: N.x - 25, z: N.z + 30, y0: 10, facing: 0, width: 2, steps: 40, mat: 'beige', slab: 0.3 });
    staircase(b, { x: N.x + 26, z: N.z - 10, y0: 40, facing: 2, width: 2, steps: 30, mat: 'beige', slab: 0.3 }); // descending from nowhere
    ring(b, { center: v3(N.x, 38, N.z), radius: 12, thickness: 0.25, mat: 'glow', spin: 0.05, spinAxis: v3(0, 0, 1), rotation: new THREE.Euler(Math.PI / 2, 0, 0) });
    for (let k = -4; k <= 4; k += 2) {
      const from = v3(N.x - N.w / 2 - 1, 8 + 13, N.z + k * 14);
      const to = from.clone().addScaledVector(sunDir, -50);
      b.add(createLightShaft(from, to, 2.2, 6, 0xffcf9e, 0.12));
    }

    // --- The vista beyond the window ------------------------------------------------
    platform(b, { x: VISTA.x, y: 0, z: VISTA.z, width: 40, depth: 30, mat: 'stone', keel: 30, edgeMat: 'rose' });
    b.box(VISTA.x - 20, 0, VISTA.z, 0.5, 1, 30, 'stone');
    b.box(VISTA.x, 0, VISTA.z - 15, 40, 1, 0.5, 'stone');
    b.box(VISTA.x, 0, VISTA.z + 15, 40, 1, 0.5, 'stone');
    b.box(VISTA.x + 20, 0, VISTA.z + 8.5, 0.5, 1, 13, 'stone');
    b.box(VISTA.x + 20, 0, VISTA.z - 8.5, 0.5, 1, 13, 'stone');
    wallWithOpenings(b, VISTA.x + 15.8, 0, VISTA.z, 3.2, 3.2, 0.4, false, [{ side: 'w', width: 1.2, height: 1.0, sill: 1.0 }], 'beige');
    arcade(b, { start: v3(VISTA.x - 160, -80, VISTA.z), direction: v3(-1, 0, 0.12), count: 7, spacing: 190, span: 110, legHeight: 150, pier: 22, depth: 22, mat: 'rose', facing: 'along', scaleStep: 0.9 });
    for (let i = 0; i < 5; i++) sculpture(b, { position: v3(VISTA.x - 120 - i * 80, 20 + i * 12, VISTA.z + rng.range(-120, 120)), size: rng.range(6, 14), kind: rng.pick(['octahedron', 'icosahedron', 'nested'] as const), mat: 'stone', innerMat: 'glow', float: 3 });
    arch(b, { x: VISTA.x - 17, z: VISTA.z, y0: 0, rotY: Math.PI / 2, span: 2.4, legHeight: 2.8, pier: 0.7, depth: 0.7, crown: 0.5, mat: 'rose' });

    addDust(kit, 0xffe0c8, 0.6, 0.04, 0.45);

    const portals: PortalDef[] = [
      { id: 'front-door', position: v3(0, 1.15, -1.99), rotY: 0, width: 1.2, height: 2.3, label: 'Go inside', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(0, 1.15, H.z0 - 0.6), rotY: 0 } },
      { id: 'front-door-back', position: v3(0, 1.15, H.z0 - 0.02), rotY: Math.PI, width: 1.2, height: 2.3, label: 'Step outside', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(0, 1.15, -1.4), rotY: Math.PI } },
      { id: 'nave-door', position: v3(0, 1.1, H.z0 - H.len + 0.02), rotY: 0, width: 1.1, height: 2.2, label: 'Open the door at the end of the hall', discovery: 'house-larger', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(N.x, 1.1, south - 0.6), rotY: 0 } },
      { id: 'nave-back', position: v3(N.x, 1.1, south - 0.02), rotY: Math.PI, width: 1.1, height: 2.2, label: 'Return to the hallway', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(0, 1.1, H.z0 - H.len + 0.6), rotY: Math.PI } },
      { id: 'turned-door', position: v3(9.88, 1.1, H.z0 - 8), rotY: -Math.PI / 2, width: 1.1, height: 2.2, label: 'Step into the turned room', discovery: 'house-turned', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(TURNED.x - 2.4, 1.1, TURNED.z - 1.6), rotY: -Math.PI / 2, roll: Math.PI / 2 } },
      { id: 'turned-back', position: v3(TURNED.x - 2.98, 1.1, TURNED.z + 1.6), rotY: Math.PI / 2, width: 1.1, height: 2.2, label: 'Return to the parlour', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(9.3, 1.1, H.z0 - 8), rotY: Math.PI / 2, roll: -Math.PI / 2 } },
      { id: 'study-window', position: v3(-9.88, 1.5, H.z0 - 8), rotY: Math.PI / 2, width: 1.2, height: 1.0, label: 'Climb through the window', discovery: 'house-window', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(VISTA.x + 15, 1.5, VISTA.z), rotY: Math.PI / 2 - 0.45 } },
      { id: 'vista-window', position: v3(VISTA.x + 15.58, 1.5, VISTA.z), rotY: -Math.PI / 2, width: 1.2, height: 1.0, label: 'Climb back into the study', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(-9.3, 1.5, H.z0 - 8), rotY: -Math.PI / 2 } },
      { id: 'attic-door', position: v3(-9.88, 4.1, H.z0 - 20), rotY: Math.PI / 2, width: 1.1, height: 2.2, label: 'Go up to the attic', discovery: 'house-stair', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(CELLAR.x + 3.4, CELLAR.y + 1.1, CELLAR.z), rotY: Math.PI / 2 } },
      { id: 'cellar-door', position: v3(CELLAR.x, CELLAR.y + 1.25 + 1.1, CELLAR.z - 6 + 0.02), rotY: 0, width: 1.1, height: 2.2, label: 'Climb out of the cellar', tint: 0xffd2b0,
        target: { kind: 'local', position: v3(0, 1.1, H.z0 - 2), rotY: 0 } },
      { id: 'vista-gate', position: v3(VISTA.x - 17.1, 1.4, VISTA.z), rotY: Math.PI / 2, width: 2.4, height: 2.8, label: 'Walk toward the last horizon', tint: 0xffb48a,
        target: { kind: 'world', worldId: 'last-horizon', arrival: 'from-house' } },
      { id: 'garden-gate', position: v3(0, 1.4, 23.6), rotY: Math.PI, width: 2.4, height: 2.6, label: 'Pass through the garden gate', tint: 0xdfe8f0,
        target: { kind: 'world', worldId: 'sunken-cathedral', arrival: 'default' } },
    ];

    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: v3(0, 0, 13), yaw: 0 },
      arrivals: {
        'from-obsidian': { position: v3(5, 0, 12), yaw: 0.3 },
        'from-horizon': { position: v3(VISTA.x + 10, 0, VISTA.z), yaw: Math.PI / 2 },
      },
      killY: -40,
      soundscape: 'house',
      portals,
      emitters: [{ position: v3(N.x, 38, N.z), kind: 'hum', radius: 80, pitch: 146.8 }],
      cinematic: [
        { points: [v3(-14, 3, 18), v3(0, 4, 20), v3(14, 3.5, 12)], look: [v3(0, 3, -6), v3(0, 3, -6), v3(0, 3, -6)], duration: 18 },
        { points: [v3(0, 1.7, H.z0 - 1), v3(0, 1.7, H.z0 - 12), v3(0, 1.7, H.z0 - 26)], look: [v3(0, 1.5, H.z0 - 10), v3(0, 1.5, H.z0 - 24), v3(0, 1.2, H.z0 - 31)], duration: 16 },
        { points: [v3(N.x - 6, 2, south - 4), v3(N.x, 12, N.z + 20), v3(N.x + 8, 30, N.z - 30)], look: [v3(N.x, 10, N.z), v3(N.x, 24, N.z - 20), v3(N.x, 30, N.z - 70)], duration: 22 },
        { points: [v3(6, 1.6, H.z0 - 5), v3(7.5, 1.6, H.z0 - 7), v3(9, 1.6, H.z0 - 8)], look: [v3(10, 1.4, H.z0 - 8), v3(12, 1.4, H.z0 - 8), v3(14, 1.4, H.z0 - 8)], duration: 12 },
        { points: [v3(VISTA.x + 12, 2, VISTA.z + 8), v3(VISTA.x, 3, VISTA.z), v3(VISTA.x - 14, 6, VISTA.z - 6)], look: [v3(VISTA.x - 200, 40, VISTA.z), v3(VISTA.x - 400, 60, VISTA.z), v3(VISTA.x - 600, 60, VISTA.z + 40)], duration: 22 },
      ],
    });
  },
};
