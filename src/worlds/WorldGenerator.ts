import * as THREE from 'three';
import { RNG } from '../core/rng';
import { arcade, arch, type ArchStyle } from '../architecture/Arches';
import { colonnade, pillar, type PillarStyle } from '../architecture/Pillars';
import { staircase } from '../architecture/Staircases';
import { bridge } from '../architecture/Bridges';
import { skyline, tower } from '../architecture/Towers';
import { platform, ring, sculpture, type SculptureKind } from '../architecture/Structures';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { createWater } from '../rendering/Water';
import { createCloudLayer } from '../rendering/Effects';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { ArchBuilder } from '../architecture/Builder';
import type { CinematicShot, WorldDefinition } from './types';

export interface Palette {
  name: string;
  top: number;
  horizon: number;
  bottom: number;
  sun: number;
  sunElevation: number;
  stone: [number, number, number];
  metal: number;
  glow: number;
  fog: number;
  exposure: number;
  hemiSky: number;
  hemiGround: number;
  clouds: number;
  stars: number;
  cloudLit: number;
  cloudShadow: number;
}

export const PALETTES: Palette[] = [
  { name: 'Ivory Dawn', top: 0x6d8fb5, horizon: 0xf1ddc6, bottom: 0xc7b8b0, sun: 0xffe6c4, sunElevation: 0.22, stone: [0xe2d9c9, 0xb9ad9b, 0x8e8576], metal: 0xb89a63, glow: 0xffe1a8, fog: 0.0026, exposure: 0.8, hemiSky: 0xdfe4ec, hemiGround: 0x6c6258, clouds: 0.5, stars: 0, cloudLit: 0xfff1e0, cloudShadow: 0xa9a2ad },
  { name: 'Ash & Rose Dusk', top: 0x2f2c48, horizon: 0xdfa197, bottom: 0x6f5866, sun: 0xffb98f, sunElevation: 0.08, stone: [0x8f8186, 0x6b5f66, 0xc29a94], metal: 0xc49a7a, glow: 0xffb08a, fog: 0.0034, exposure: 1.0, hemiSky: 0xb79aa6, hemiGround: 0x2b2228, clouds: 0.55, stars: 0.2, cloudLit: 0xffbfa2, cloudShadow: 0x5e4f6e },
  { name: 'Midnight Basalt', top: 0x04060c, horizon: 0x1a2236, bottom: 0x05060a, sun: 0x93a7ff, sunElevation: 0.3, stone: [0x1b1d22, 0x2b2e35, 0x101114], metal: 0x6b7fa8, glow: 0x5fa0ff, fog: 0.004, exposure: 1.2, hemiSky: 0x2b3352, hemiGround: 0x050507, clouds: 0, stars: 1, cloudLit: 0x334466, cloudShadow: 0x0a0d18 },
  { name: 'Verdigris Noon', top: 0x3f7f96, horizon: 0xcfe2dc, bottom: 0x8fa9a3, sun: 0xfff6e8, sunElevation: 0.7, stone: [0xb8c2b8, 0x7f948c, 0x5d6f69], metal: 0x6f9c8a, glow: 0xb8fff0, fog: 0.0022, exposure: 0.72, hemiSky: 0xd6ece6, hemiGround: 0x4c5752, clouds: 0.65, stars: 0, cloudLit: 0xffffff, cloudShadow: 0x9fb4b0 },
  { name: 'Ochre Haze', top: 0x8d7a5e, horizon: 0xe7c38e, bottom: 0xa4835c, sun: 0xffd08a, sunElevation: 0.35, stone: [0xc89b6a, 0x9c7550, 0x6e5139], metal: 0xd1a35c, glow: 0xffc070, fog: 0.0045, exposure: 0.8, hemiSky: 0xe8cfa6, hemiGround: 0x4f3a28, clouds: 0.3, stars: 0, cloudLit: 0xffe0b0, cloudShadow: 0xa3825e },
  { name: 'Lavender Fog', top: 0x6f6a9a, horizon: 0xd8cfe6, bottom: 0x9a92b0, sun: 0xfff0f6, sunElevation: 0.45, stone: [0xd6d0de, 0xa79fb6, 0x7c7590], metal: 0xb7a9d6, glow: 0xe8d8ff, fog: 0.0058, exposure: 0.85, hemiSky: 0xe4dcf0, hemiGround: 0x5a5368, clouds: 0.4, stars: 0, cloudLit: 0xffffff, cloudShadow: 0xb0a6c6 },
];

export type Layout = 'processional' | 'radial' | 'terraced' | 'archipelago';
export type Ground = 'water' | 'plain' | 'clouds';

export interface Plan {
  seed: number;
  palette: Palette;
  layout: Layout;
  ground: Ground;
  pillarStyle: PillarStyle;
  archStyle: ArchStyle;
  monument: 'tower' | 'ring-gate' | 'sculpture' | 'great-arch';
  length: number;
  sunAzimuth: number;
}

/** Pure, deterministic choice of a world's ingredients from a seed. */
export function planWorld(seed: number): Plan {
  const rng = new RNG(seed);
  const palette = rng.pick(PALETTES);
  const layout = rng.pick(['processional', 'radial', 'terraced', 'archipelago'] as const);
  const ground: Ground = layout === 'archipelago' ? 'clouds' : rng.pick(['water', 'plain', 'clouds'] as const);
  return {
    seed,
    palette,
    layout,
    ground,
    pillarStyle: rng.pick(['square', 'round', 'cruciform', 'fluted', 'stepped'] as const),
    archStyle: rng.pick(['round', 'pointed', 'flat', 'stilted'] as const),
    monument: rng.pick(['tower', 'ring-gate', 'sculpture', 'great-arch'] as const),
    length: Math.round(rng.range(120, 220)),
    sunAzimuth: rng.range(-1.2, 1.2),
  };
}

function monument(b: ArchBuilder, rng: RNG, kind: Plan['monument'], at: THREE.Vector3): void {
  switch (kind) {
    case 'tower':
      tower(b, { x: at.x, z: at.z, y0: at.y, width: 22, height: rng.range(120, 220), tiers: 4, setback: 0.16, mat: 'stone', windowMat: 'glow' });
      break;
    case 'ring-gate':
      ring(b, { center: at.clone().add(v3(0, 40, 0)), radius: 36, thickness: 2.4, mat: 'metal', spin: 0.03, spinAxis: v3(0, 0, 1) });
      ring(b, { center: at.clone().add(v3(0, 40, 0)), radius: 26, thickness: 1.2, mat: 'stone', spin: -0.05, spinAxis: v3(0, 1, 0) });
      b.box(at.x, at.y, at.z, 18, 4, 18, 'stone');
      break;
    case 'sculpture':
      b.box(at.x, at.y, at.z, 14, 3, 14, 'stone');
      sculpture(b, { position: at.clone().add(v3(0, 22, 0)), size: 12, kind: 'nested', mat: 'metal', innerMat: 'glow', float: 2, spin: 0.04 });
      break;
    case 'great-arch':
      arch(b, { x: at.x, z: at.z, y0: at.y, span: 40, legHeight: 60, pier: 12, depth: 10, crown: 10, mat: 'stone', style: 'pointed' });
      break;
  }
}

export const RandomWorld: WorldDefinition = {
  id: 'random',
  numeral: '∞',
  name: 'A Random World',
  tagline: 'Assembled from a seed.',
  description: 'Seeded procedural composition.',
  build(ctx) {
    const plan = planWorld(ctx.seed || 1);
    const p = plan.palette;
    const rng = new RNG(plan.seed ^ 0x5bd1e995);
    const sunDir = v3(Math.sin(plan.sunAzimuth), plan.palette.sunElevation, -Math.cos(plan.sunAzimuth)).normalize();
    const kit = beginWorld(
      ctx,
      {
        stone: createArchMaterial({ color: p.stone[0], roughness: 0.85, variation: 0.45, panel: rng.chance(0.6) ? rng.range(1, 2.4) : 0, streaks: rng.range(0, 0.4) }),
        stone2: createArchMaterial({ color: p.stone[1], roughness: 0.8, variation: 0.4 }),
        dark: createArchMaterial({ color: p.stone[2], roughness: 0.75, variation: 0.35 }),
        metal: createArchMaterial({ color: p.metal, roughness: 0.3, metalness: 0.8, variation: 0.2 }),
        far: createArchMaterial({ color: new THREE.Color(p.horizon).lerp(new THREE.Color(p.stone[1]), 0.5).getHex(), roughness: 1, variation: 0.15 }),
        glow: createGlowMaterial(p.glow, 3, 0.3, 0.8),
      },
      {
        sky: { top: p.top, horizon: p.horizon, bottom: p.bottom, sunDirection: sunDir, sunColor: p.sun, clouds: p.clouds, stars: p.stars, cloudColor: p.cloudLit, cloudShadow: p.cloudShadow },
        fogDensity: p.fog,
        sunIntensity: p.stars > 0.5 ? 1.2 : 3,
        hemiSky: p.hemiSky,
        hemiGround: p.hemiGround,
        hemiIntensity: 0.5,
        environmentIntensity: 0.5,
        exposure: p.exposure,
        bloom: p.stars > 0.5 ? 0.6 : 0.3,
        shadowRange: 80,
      },
    );
    const { b } = kit;
    const L = plan.length;
    const end = v3(0, 0, -L);
    let monumentBase = end.clone();

    // Ground plane.
    if (plan.ground === 'water' || plan.ground === 'plain') {
      b.box(0, -2.4, -L / 2, 3000, 2, 3000, plan.ground === 'plain' ? 'stone2' : 'dark');
      if (plan.ground === 'water') {
        const water = createWater({ width: 3000, depth: 3000, color: new THREE.Color(p.bottom).multiplyScalar(0.35).getHex(), opacity: 0.8, reflectivity: 0.85, resolutionScale: ctx.quality.reflectionScale });
        water.position.set(0, 0, -L / 2);
        b.add(water);
      }
    } else {
      b.add(createCloudLayer({ y: -50, lit: p.cloudLit, shadow: p.cloudShadow, horizon: p.horizon, sunDirection: sunDir, cover: 0.4, octaves: ctx.quality.cloudOctaves }));
    }
    const floorY = plan.ground === 'clouds' ? 0 : -0.4;

    // Foreground: the spawn platform.
    platform(b, { x: 0, y: floorY + 0.4, z: 6, width: 18, depth: 14, mat: 'stone', keel: plan.ground === 'clouds' ? 14 : 0, thickness: plan.ground === 'clouds' ? 2 : 0.8 });

    // Middle ground: the route toward the monument.
    switch (plan.layout) {
      case 'processional': {
        if (plan.ground === 'clouds') bridge(b, { from: v3(0, 0.4, -1), to: v3(0, 0.4, -L + 12), width: 14, mat: 'stone', rails: false, thickness: 2 });
        const spacing = rng.range(9, 14);
        const count = Math.floor((L - 20) / spacing);
        const h = rng.range(14, 30);
        for (const sx of [-1, 1]) {
          if (rng.chance(0.5)) {
            colonnade(b, { start: v3(sx * 9, floorY, -8), direction: v3(0, 0, -1), count, spacing, height: h, size: 1.2, style: plan.pillarStyle, mat: 'stone', capital: true, base: true });
          } else {
            arcade(b, { start: v3(sx * 9, floorY, -8 - spacing / 2), direction: v3(0, 0, -1), count, spacing, span: spacing - 2.4, legHeight: h * 0.6, pier: 2.4, depth: 2, mat: 'stone', style: plan.archStyle, facing: 'across' });
          }
        }
        if (rng.chance(0.6)) for (let z = -8; z > -L + 20; z -= spacing * 2) b.box(0, floorY + h, z, 20, 1.2, spacing * 0.8, 'stone2', { collide: false });
        if (plan.ground === 'clouds') monumentBase = v3(0, 0.4, -L + 12);
        break;
      }
      case 'radial': {
        const C = end.clone();
        if (plan.ground === 'clouds') {
          bridge(b, { from: v3(0, 0.4, -1), to: v3(0, 0.4, C.z + 40), width: 8, mat: 'stone', thickness: 2 });
          platform(b, { x: C.x, y: 0.4, z: C.z, width: 80, depth: 80, mat: 'stone', keel: 60, thickness: 3 });
        } else {
          b.box(C.x, floorY, C.z, 80, 0.6, 80, 'stone');
        }
        const spokes = rng.int(5, 9);
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * Math.PI * 2;
          const r = 52;
          arch(b, { x: C.x + Math.cos(a) * r, z: C.z + Math.sin(a) * r, y0: floorY, rotY: -a + Math.PI / 2, span: 8, legHeight: 14, pier: 2.5, depth: 2.5, mat: 'stone', style: plan.archStyle, collide: false });
          pillar(b, { x: C.x + Math.cos(a) * 34, z: C.z + Math.sin(a) * 34, y0: floorY, height: 20, size: 1.4, style: plan.pillarStyle, mat: 'stone2', capital: true });
        }
        ring(b, { center: C.clone().add(v3(0, 60, 0)), radius: 44, thickness: 1.2, mat: 'metal', spin: 0.02, spinAxis: v3(1, 0, 0.2), rotation: new THREE.Euler(Math.PI / 2, 0, 0) });
        monumentBase = v3(C.x, plan.ground === 'clouds' ? 0.4 : floorY + 0.6, C.z);
        break;
      }
      case 'terraced': {
        const steps = rng.int(3, 5);
        let y = floorY + 0.4;
        let z = -2;
        const depth = (L - 10) / steps;
        for (let i = 0; i < steps; i++) {
          const rise = rng.int(12, 24) * 0.25;
          staircase(b, { x: 0, z: z + 1, y0: y, facing: 0, width: 6, steps: Math.round(rise / 0.25), mat: 'stone2', solid: true });
          y += rise;
          z -= (rise / 0.25) * 0.45;
          b.box(0, floorY - 0.5, z - depth / 2, 40 - i * 4, y - floorY + 0.5, depth, 'stone');
          for (const sx of [-1, 1]) pillar(b, { x: sx * (16 - i * 2), z: z - depth / 2, y0: y, height: 8 + i * 2, size: 0.9, style: plan.pillarStyle, mat: 'stone2', capital: true });
          if (rng.chance(0.6)) arch(b, { x: 0, z: z - 3, y0: y, span: 8, legHeight: 7, pier: 1.6, depth: 1.6, mat: 'stone2', style: plan.archStyle });
          z -= depth;
        }
        monumentBase = v3(0, y, z + depth / 2);
        break;
      }
      case 'archipelago': {
        let prev = v3(0, 0.4, 0);
        const islands = rng.int(4, 6);
        for (let i = 1; i <= islands; i++) {
          const t = i / islands;
          const next = v3(Math.sin(i * 1.7 + plan.seed) * 30 * (1 - t), 0.4 + rng.int(0, 8) * 0.5, -L * t);
          const s = i === islands ? 40 : rng.range(16, 26);
          platform(b, { x: next.x, y: next.y, z: next.z, width: s, depth: s, mat: 'stone', keel: s * 0.9, thickness: 2 });
          const dir = next.clone().sub(prev).setY(0).normalize();
          const from = prev.clone().addScaledVector(dir, i === 1 ? 6 : 8);
          const to = next.clone().addScaledVector(dir, -s / 2 + 1);
          from.y = prev.y;
          to.y = next.y;
          bridge(b, { from, to, width: 4, mat: 'stone2', thickness: 1 });
          if (i < islands && rng.chance(0.7)) pillar(b, { x: next.x + s / 3, z: next.z, y0: next.y, height: rng.range(6, 16), size: 0.9, style: plan.pillarStyle, mat: 'stone2', capital: true });
          prev = next;
        }
        monumentBase = prev.clone();
        break;
      }
    }
    monument(b, rng, plan.monument, monumentBase);

    // Background: distant skyline and a few floating forms.
    skyline(b, rng.fork('skyline'), { cx: 0, cz: -L / 2, inner: 320, outer: 900, count: 36, minH: 50, maxH: 260, mat: 'far', y0: plan.ground === 'clouds' ? -120 : -1 });
    const kinds: SculptureKind[] = ['octahedron', 'tetrahedron', 'icosahedron', 'shard'];
    for (let i = 0; i < 6; i++) {
      sculpture(b, { position: v3(rng.range(-60, 60), rng.range(15, 50), -rng.range(20, L)), size: rng.range(2, 6), kind: rng.pick(kinds), mat: rng.chance(0.5) ? 'metal' : 'dark', float: 1.2 });
    }
    addDust(kit, p.glow, 0.5, 0.05, 0.4);

    const M = monumentBase;
    const cinematic: CinematicShot[] = [
      { points: [v3(0, 2, 10), v3(0, 3, -L * 0.4), v3(0, 6, -L * 0.75)], look: [v3(0, 6, -L * 0.3), v3(M.x, M.y + 20, M.z), v3(M.x, M.y + 30, M.z)], duration: 22 },
      {
        points: [0, 1, 2, 3].map((i) => v3(M.x + Math.cos(i * 0.6) * 90, M.y + 25 + i * 6, M.z + Math.sin(i * 0.6) * 90)),
        look: [v3(M.x, M.y + 25, M.z), v3(M.x, M.y + 30, M.z)],
        duration: 24,
      },
      { points: [v3(-30, 3, -L * 0.2), v3(-40, 30, -L * 0.5), v3(-20, 70, -L * 0.8)], look: [v3(0, 10, -L * 0.4), v3(0, 20, -L * 0.7), v3(M.x, M.y + 20, M.z)], duration: 20 },
    ];

    const world = finishWorld(kit, {
      id: 'random',
      name: `Seed ${plan.seed} · ${p.name}`,
      subtitle: `A ${plan.layout} composition over ${plan.ground === 'clouds' ? 'clouds' : plan.ground}.`,
      spawn: { position: v3(0, floorY + 0.4, 9), yaw: 0 },
      killY: plan.ground === 'clouds' ? -45 : -30,
      soundscape: plan.palette.stars > 0.5 ? 'obsidian' : plan.ground === 'clouds' ? 'horizon' : plan.ground === 'water' ? 'cathedral' : 'ascent',
      cinematic,
      seed: plan.seed,
    });
    return world;
  },
};
