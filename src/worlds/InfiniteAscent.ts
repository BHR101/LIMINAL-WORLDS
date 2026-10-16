import * as THREE from 'three';
import { RNG } from '../core/rng';
import { arch, arcade } from '../architecture/Arches';
import { pillar } from '../architecture/Pillars';
import { staircase, spiralStair } from '../architecture/Staircases';
import { bridge } from '../architecture/Bridges';
import { hangingTower, tower } from '../architecture/Towers';
import { platform, ring, sculpture } from '../architecture/Structures';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { createCloudLayer } from '../rendering/Effects';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { ArchBuilder } from '../architecture/Builder';
import type { PortalDef } from '../architecture/Portals';
import type { WorldDefinition } from './types';

const INV = v3(0, 0, -2600); // the inverted district, far out in the haze

/** Low walls around a square platform, leaving gaps for bridges on the given sides. */
function parapets(b: ArchBuilder, cx: number, y: number, cz: number, size: number, gaps: ('n' | 's' | 'e' | 'w')[], mat: string, gap = 7): void {
  const h = size / 2;
  const seg = (x: number, z: number, sx: number, sz: number) => b.box(x, y, z, sx, 0.9, sz, mat);
  for (const side of ['n', 's', 'e', 'w'] as const) {
    const alongX = side === 'n' || side === 's';
    const fixed = side === 'n' ? cz - h : side === 's' ? cz + h : side === 'e' ? cx + h : cx - h;
    if (!gaps.includes(side)) {
      if (alongX) seg(cx, fixed, size, 0.4);
      else seg(fixed, cz, 0.4, size);
      continue;
    }
    const part = (size - gap) / 2;
    if (alongX) {
      seg(cx - gap / 2 - part / 2, fixed, part, 0.4);
      seg(cx + gap / 2 + part / 2, fixed, part, 0.4);
    } else {
      seg(fixed, cz - gap / 2 - part / 2, 0.4, part);
      seg(fixed, cz + gap / 2 + part / 2, 0.4, part);
    }
  }
}

export const InfiniteAscent: WorldDefinition = {
  id: 'infinite-ascent',
  numeral: 'II',
  name: 'The Infinite Ascent',
  tagline: 'Every stair arrives somewhere. Not always somewhere new.',
  description:
    'Pale stairs, bridges and floating terraces around a colossal tower above the clouds. Some routes are real. Some only look like they are.',
  build(ctx) {
    const rng = new RNG(ctx.seed || 202);
    const sunDir = v3(-0.62, 0.52, -0.3).normalize();
    const kit = beginWorld(
      ctx,
      {
        stone: createArchMaterial({ color: 0xd8d2c6, roughness: 0.82, variation: 0.35, panel: 1.5, streaks: 0.15 }),
        white: createArchMaterial({ color: 0xeeebe4, roughness: 0.7, variation: 0.25, scale: 0.3 }),
        gold: createArchMaterial({ color: 0xb79c66, roughness: 0.32, metalness: 0.75, variation: 0.25 }),
        blue: createArchMaterial({ color: 0x9db1c4, roughness: 0.75, variation: 0.3 }),
        distant: createArchMaterial({ color: 0xc7d3de, roughness: 0.95, variation: 0.15 }),
        glow: createGlowMaterial(0xfff0c8, 4, 0.4, 1),
      },
      {
        sky: {
          top: 0x3f7cc4,
          horizon: 0xc4d8ea,
          bottom: 0xb6cadb,
          sunDirection: sunDir,
          sunColor: 0xfff3dc,
          sunSize: 0.0009,
          clouds: 0.7,
          cloudColor: 0xffffff,
          cloudShadow: 0xb0c0d0,
        },
        fogDensity: 0.0012,
        sunIntensity: 3.3,
        hemiSky: 0xcfe0f2,
        hemiGround: 0x8a8f96,
        hemiIntensity: 0.45,
        environmentIntensity: 0.4,
        exposure: 0.72,
        bloom: 0.25,
        shadowRange: 80,
        vignette: 0.3,
      },
    );
    const { b } = kit;

    // Sea of clouds far below.
    b.add(
      createCloudLayer({
        y: -140,
        lit: 0xffffff,
        shadow: 0xa9b9cc,
        horizon: 0xd2e2ee,
        sunDirection: sunDir,
        cover: 0.38,
        scale: 0.0035,
        octaves: ctx.quality.cloudOctaves,
      }),
    );

    // --- Central tower -----------------------------------------------------------
    b.cylinder(0, -260, 0, 14, 560, 'stone');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      b.box(Math.cos(a) * 14, -260, Math.sin(a) * 14, 1.6, 560, 1.6, 'white', { rotY: -a, collide: false });
    }
    for (let y = -90; y < 300; y += 30) ring(b, { center: v3(0, y, 0), radius: 14.6, thickness: 0.5, mat: 'gold', rotation: new THREE.Euler(Math.PI / 2, 0, 0) });
    b.cylinder(0, 300, 0, 9, 40, 'white');
    sculpture(b, { position: v3(0, 360, 0), size: 10, kind: 'octahedron', mat: 'gold', float: 3, spin: 0.05 });

    // Square plinth around the tower base.
    b.box(0, -2, -18, 44, 2, 8, 'stone');
    b.box(0, -2, 18, 44, 2, 8, 'stone');
    b.box(18, -2, 0, 8, 2, 28, 'stone');
    b.box(-18, -2, 0, 8, 2, 28, 'stone');
    platform(b, { x: 0, y: -2, z: 0, width: 44, depth: 44, thickness: 6, mat: 'stone', keel: 40 });

    // Spiral stair to the high balcony at y = 60.
    spiralStair(b, { x: 0, z: 0, y0: 0, radius: 14, width: 3.6, steps: 240, rise: 0.25, angleStep: 0.06, startAngle: Math.PI * 0.25, mat: 'white' });
    // Balcony ring sits outside the spiral's band so the stair has headroom.
    b.box(0, 59, -22, 52, 1, 8, 'stone');
    b.box(0, 59, 22, 52, 1, 8, 'stone');
    b.box(22, 59, 0, 8, 1, 36, 'stone');
    b.box(-22, 59, 0, 8, 1, 36, 'stone');
    parapets(b, 0, 60, 0, 52, ['s'], 'white', 4);

    // --- Spawn plaza (south) and its bridge of diminishing arches -----------------
    platform(b, { x: 0, y: 0, z: 70, width: 30, depth: 30, mat: 'stone', keel: 26, edgeMat: 'gold' });
    parapets(b, 0, 0, 70, 30, ['n'], 'white');
    bridge(b, { from: v3(0, 0, 55), to: v3(0, 0, 22), width: 6, mat: 'stone', railMat: 'white', underside: 'ribbed' });
    arcade(b, { start: v3(0, 0, 52), direction: v3(0, 0, -1), count: 6, spacing: 5.5, span: 5.2, legHeight: 6, pier: 1.2, depth: 1.2, mat: 'white', scaleStep: 0.94, facing: 'along' });
    for (const sx of [-11, 11]) pillar(b, { x: sx, z: 80, y0: 0, height: 12, size: 0.8, style: 'fluted', mat: 'white', base: true, capital: true });
    sculpture(b, { position: v3(0, 9, 78), size: 1.6, kind: 'nested', mat: 'gold', innerMat: 'glow', float: 0.4 });

    // --- East: the stair that returns ------------------------------------------
    platform(b, { x: 70, y: 0, z: 0, width: 24, depth: 24, mat: 'stone', keel: 22, edgeMat: 'gold' });
    parapets(b, 70, 0, 0, 24, ['w', 'e'], 'white', 4);
    bridge(b, { from: v3(22, 0, 0), to: v3(58, 0, 0), width: 5, mat: 'stone', railMat: 'white', underside: 'ribbed' });
    const top = staircase(b, { x: 82, z: 0, y0: 0, facing: 1, width: 3.2, steps: 60, rise: 0.25, tread: 0.5, mat: 'white', slab: 0.5, parapet: 1 });
    platform(b, { x: 115, y: top.y, z: 0, width: 6, depth: 5, mat: 'stone', keel: 4 });
    b.box(115, top.y, -2.3, 6, 1, 0.4, 'white');
    b.box(115, top.y, 2.3, 6, 1, 0.4, 'white');
    arch(b, { x: 117.4, z: 0, y0: top.y, rotY: Math.PI / 2, span: 2.8, legHeight: 3.2, pier: 1, depth: 1, crown: 0.8, mat: 'gold' });
    // A second, impossible stair seen from the landing — it climbs into the clouds and ends.
    staircase(b, { x: 96, z: 26, y0: 6, facing: 1, width: 3, steps: 120, rise: 0.25, tread: 0.5, mat: 'white', slab: 0.4 });
    staircase(b, { x: 60, z: -30, y0: 10, facing: 0, width: 3, steps: 90, rise: 0.3, tread: 0.5, mat: 'white', slab: 0.4 });

    // --- West: the resonant lectern facing the tower -----------------------------
    platform(b, { x: -70, y: 0, z: 0, width: 24, depth: 24, mat: 'stone', keel: 22, edgeMat: 'gold' });
    parapets(b, -70, 0, 0, 24, ['e'], 'white', 4);
    bridge(b, { from: v3(-22, 0, 0), to: v3(-58, 0, 0), width: 5, mat: 'stone', railMat: 'white', underside: 'ribbed' });
    b.box(-74, 0, 0, 1.2, 1.1, 2.2, 'gold');
    b.box(-74, 1.1, 0, 0.9, 0.08, 1.6, 'glow', { collide: false });
    for (const z of [-8, 8]) pillar(b, { x: -76, z, y0: 0, height: 9, size: 0.7, style: 'fluted', mat: 'white', capital: true });

    // --- North: the stair through the high arch -----------------------------------
    platform(b, { x: 0, y: 0, z: -80, width: 26, depth: 26, mat: 'stone', keel: 24, edgeMat: 'gold' });
    parapets(b, 0, 0, -80, 26, ['s', 'n'], 'white', 4);
    bridge(b, { from: v3(0, 0, -22), to: v3(0, 0, -67), width: 5, mat: 'stone', railMat: 'white', underside: 'ribbed' });
    const ntop = staircase(b, { x: 0, z: -93, y0: 0, facing: 0, width: 3.2, steps: 48, rise: 0.25, tread: 0.5, mat: 'white', slab: 0.5, parapet: 1 });
    platform(b, { x: 0, y: ntop.y, z: -120, width: 5, depth: 6, mat: 'stone', keel: 4 });
    arch(b, { x: 0, z: -121.6, y0: ntop.y, span: 2.8, legHeight: 3.2, pier: 1, depth: 1, crown: 0.8, mat: 'gold' });
    arch(b, { x: 0, z: -95, y0: 0, span: 4.4, legHeight: 6, pier: 1.4, depth: 1.4, mat: 'white' });

    // --- High route: balcony → bridge → floating terraces -------------------------
    platform(b, { x: 0, y: 60, z: 48, width: 14, depth: 14, mat: 'stone', keel: 12 });
    bridge(b, { from: v3(0, 60, 26), to: v3(0, 60, 41), width: 4, mat: 'stone', railMat: 'white' });
    staircase(b, { x: 0, z: 55, y0: 60, facing: 2, width: 3, steps: 40, rise: 0.3, tread: 0.55, mat: 'white', slab: 0.4, parapet: 1 });
    platform(b, { x: 0, y: 72, z: 82, width: 16, depth: 14, mat: 'stone', keel: 14, edgeMat: 'gold' });
    parapets(b, 0, 72, 82, 14, ['n'], 'white', 4);
    sculpture(b, { position: v3(0, 78, 82), size: 1.8, kind: 'icosahedron', mat: 'gold', float: 0.5 });

    // Inverted slabs: arcades hanging upside down in the sky.
    const flip = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const r = 110 + (i % 2) * 40;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = 70 + (i % 3) * 25;
      // An upside-down aqueduct: a deck with arches hanging beneath it.
      b.box(x, y, z, 15, 4, 66, 'stone', { rotY: -a + Math.PI / 2, collide: false });
      const q = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), -a + Math.PI / 2).multiply(flip);
      for (let k = -2; k <= 2; k++) {
        const ox = Math.cos(a + Math.PI / 2) * k * 13;
        const oz = Math.sin(a + Math.PI / 2) * k * 13;
        arch(b, { x: x + ox, z: z + oz, y0: y, span: 9, legHeight: 12, pier: 4, depth: 5, crown: 3, mat: 'white', quaternion: q, collide: false });
      }
    }

    // Floating platforms with stairs that go nowhere, at many scales.
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(140, 420);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = rng.range(-40, 160);
      const s = rng.range(10, 30);
      platform(b, { x, y, z, width: s, depth: s * rng.range(0.6, 1.2), mat: rng.chance(0.3) ? 'blue' : 'distant', keel: s * 0.9, thickness: 2 });
      if (rng.chance(0.6)) staircase(b, { x, z, y0: y, facing: rng.int(0, 3) as 0 | 1 | 2 | 3, width: 3, steps: rng.int(20, 60), mat: 'distant', slab: 0.4 });
      if (rng.chance(0.5)) tower(b, { x: x + s * 0.2, z, y0: y, width: s * 0.3, height: rng.range(20, 70), tiers: 3, mat: 'distant', collide: false, castShadow: false });
    }

    // Colossal rotating rings around the tower.
    const rings = [
      { mesh: ring(b, { center: v3(0, 95, 0), radius: 44, thickness: 1.4, mat: 'gold' }), axis: v3(1, 0, 0.3).normalize(), speed: 0.03 },
      { mesh: ring(b, { center: v3(0, 140, 0), radius: 62, thickness: 1.8, mat: 'white' }), axis: v3(0.2, 0, 1).normalize(), speed: -0.022 },
      { mesh: ring(b, { center: v3(0, 195, 0), radius: 84, thickness: 2.2, mat: 'gold' }), axis: v3(1, 0, -0.6).normalize(), speed: 0.016 },
    ];
    rings.forEach((r, i) => r.mesh.rotation.set(Math.PI / 2 + 0.5 * (i + 1), 0.3 * i, 0));
    let align = 0;
    let alignTarget = 0;
    let alignTimer = 0;
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const free = rings.map((r) => r.mesh.quaternion.clone());
    kit.onUpdate.push((dt) => {
      if (alignTimer > 0) {
        alignTimer -= dt;
        if (alignTimer <= 0) alignTarget = 0;
      }
      align += (alignTarget - align) * (1 - Math.exp(-dt * 0.5));
      rings.forEach((r, i) => {
        free[i].multiply(new THREE.Quaternion().setFromAxisAngle(r.axis, r.speed * dt * (1 - align)));
        r.mesh.quaternion.slerpQuaternions(free[i], flat, align);
      });
    });

    // Distant towers in the haze, some standing on nothing.
    for (let i = 0; i < 30; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(500, 1100);
      tower(b, { x: Math.cos(a) * r, z: Math.sin(a) * r, y0: rng.range(-150, 0), width: rng.range(14, 40), height: rng.range(120, 380), tiers: rng.int(2, 4), setback: 0.18, mat: 'distant', collide: false, castShadow: false });
    }

    // --- The inverted district --------------------------------------------------
    platform(b, { x: INV.x, y: 0, z: INV.z, width: 30, depth: 30, mat: 'stone', keel: 26, edgeMat: 'gold' });
    parapets(b, INV.x, 0, INV.z, 30, ['n', 's'], 'white', 4);
    b.box(INV.x, 80, INV.z, 420, 6, 420, 'stone', { collide: false, castShadow: false });
    // An avenue of hanging towers on the axis, framed by the high arch.
    for (let k = 0; k < 8; k++) {
      for (const sx of [-1, 1]) {
        hangingTower(b, { x: INV.x + sx * rng.range(14, 22), z: INV.z - 40 - k * 24, ceilingY: 80, width: rng.range(9, 14), height: rng.range(28, 52), tiers: 3, mat: k % 2 ? 'white' : 'blue', windowMat: 'gold' });
      }
    }
    for (let i = 0; i < 46; i++) {
      const x = INV.x + rng.range(-190, 190);
      const z = INV.z + rng.range(-190, 190);
      if (Math.abs(x - INV.x) < 30 && z - INV.z < 30) continue;
      hangingTower(b, { x, z, ceilingY: 80, width: rng.range(8, 22), height: rng.range(24, 60), tiers: rng.int(2, 4), mat: rng.chance(0.3) ? 'blue' : 'white', windowMat: 'gold', rotY: rng.chance(0.3) ? rng.range(0, 1) : 0 });
    }
    for (let i = -3; i <= 3; i++) arch(b, { x: INV.x + i * 16, z: INV.z - 240, y0: 80, span: 10, legHeight: 14, pier: 2.4, depth: 3, mat: 'white', quaternion: flip.clone(), collide: false });
    staircase(b, { x: INV.x + 30, z: INV.z + 30, y0: 74, facing: 3, width: 4, steps: 40, mat: 'white', slab: 0.4 }); // decorative, on the ceiling
    sculpture(b, { position: v3(INV.x, 40, INV.z - 30), size: 5, kind: 'nested', mat: 'gold', innerMat: 'glow', float: 2 });
    ring(b, { center: v3(INV.x, 60, INV.z), radius: 30, thickness: 1, mat: 'gold', spin: 0.04, spinAxis: v3(0, 1, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0) });
    arch(b, { x: INV.x + 10, z: INV.z - 13.6, y0: 0, span: 2.8, legHeight: 3.2, pier: 1, depth: 1, crown: 0.8, mat: 'gold' });

    addDust(kit, 0xffffff, 0.5, 0.04, 0.35);

    const portals: PortalDef[] = [
      {
        id: 'returning-stair',
        position: v3(117.1, top.y + 1.6, 0),
        rotY: -Math.PI / 2,
        width: 2.8,
        height: 3.2,
        label: 'Continue upward',
        discovery: 'ascent-loop',
        tint: 0xfff1d0,
        target: { kind: 'local', position: v3(80.6, 1.6, 0), rotY: -Math.PI / 2 },
      },
      {
        id: 'high-arch',
        position: v3(0, ntop.y + 1.6, -121.3),
        rotY: 0,
        width: 2.8,
        height: 3.2,
        label: 'Climb through the arch',
        discovery: 'ascent-inverted',
        tint: 0xfff1d0,
        target: { kind: 'local', position: v3(INV.x, 1.6, INV.z + 12), rotY: 0, roll: Math.PI },
      },
      {
        id: 'inverted-return',
        position: v3(INV.x + 10, 1.6, INV.z - 13.3),
        rotY: 0,
        width: 2.8,
        height: 3.2,
        label: 'Return to the right way up',
        tint: 0xfff1d0,
        target: { kind: 'local', position: v3(0, 1.6, -73), rotY: Math.PI, roll: Math.PI },
      },
      {
        id: 'ascent-to-horizon',
        position: v3(0, 72 + 1.6, 88.8),
        rotY: Math.PI,
        width: 2.4,
        height: 3.2,
        label: 'Walk toward the last horizon',
        tint: 0xffb98a,
        target: { kind: 'world', worldId: 'last-horizon', arrival: 'from-ascent' },
      },
    ];
    arch(b, { x: 0, z: 89.3, y0: 72, span: 2.4, legHeight: 3.2, pier: 0.9, depth: 0.9, crown: 0.7, mat: 'gold' });

    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: v3(0, 0, 78), yaw: 0 },
      arrivals: { 'from-horizon': { position: v3(0, 72, 84), yaw: 0 } },
      killY: -70,
      soundscape: 'ascent',
      portals,
      emitters: [
        { position: v3(0, 140, 0), kind: 'hum', radius: 160, pitch: 196 },
        { position: v3(-74, 1.5, 0), kind: 'hum', radius: 14, pitch: 293.7 },
      ],
      interactables: [
        {
          id: 'lectern',
          position: v3(-74, 1.4, 0),
          radius: 3.5,
          label: 'Strike the resonant lectern',
          onInteract: () => {
            alignTarget = 1;
            alignTimer = 26;
            ctx.services.sound('resonance');
            ctx.services.discover('ascent-rings');
          },
        },
      ],
      cinematic: [
        { points: [v3(0, 3, 95), v3(0, 4, 60), v3(0, 6, 30)], look: [v3(0, 6, 40), v3(0, 30, 0), v3(0, 90, 0)], duration: 18 },
        { points: [v3(60, 10, 70), v3(80, 30, 0), v3(50, 60, -70)], look: [v3(0, 40, 0), v3(0, 80, 0), v3(0, 120, 0)], duration: 24 },
        { points: [v3(84, 2, 6), v3(100, 9, 4), v3(112, 16.5, 1)], look: [v3(110, 12, 0), v3(120, 16, 0), v3(140, 17, 0)], duration: 16 },
        { points: [v3(-160, 120, 120), v3(-60, 170, 170), v3(60, 200, 150)], look: [v3(0, 140, 0), v3(0, 160, 0), v3(0, 170, 0)], duration: 24 },
        { points: [v3(-40, 5, -60), v3(-12, 8, -100), v3(10, 16, -135)], look: [v3(0, 8, -110), v3(0, 14, -122), v3(0, 30, -160)], duration: 18 },
      ],
    });
  },
};
