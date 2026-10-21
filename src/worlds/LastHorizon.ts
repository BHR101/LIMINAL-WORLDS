import * as THREE from 'three';
import { RNG } from '../core/rng';
import { arch } from '../architecture/Arches';
import { pillar, colonnade } from '../architecture/Pillars';
import { bridge } from '../architecture/Bridges';
import { staircase } from '../architecture/Staircases';
import { hangingTower } from '../architecture/Towers';
import { platform, ring, sculpture } from '../architecture/Structures';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { createCloudLayer } from '../rendering/Effects';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { PortalDef } from '../architecture/Portals';
import type { WorldDefinition } from './types';

const BRIDGE_END = -430;

export const LastHorizon: WorldDefinition = {
  id: 'last-horizon',
  numeral: 'VIII',
  name: 'The Last Horizon',
  tagline: 'The sun has been setting here for a very long time.',
  description:
    'Colossal arches stride over an ocean of cloud toward a sun that never quite sets. At the end of the long bridge, something waits for you to look up.',
  build(ctx) {
    const rng = new RNG(ctx.seed || 505);
    const sunDir = v3(0.08, 0.075, -1).normalize();
    const kit = beginWorld(
      ctx,
      {
        stone: createArchMaterial({ color: 0xc9a98a, roughness: 0.85, variation: 0.45, panel: 1.8, streaks: 0.25 }),
        warm: createArchMaterial({ color: 0xd8b48e, roughness: 0.8, variation: 0.35, scale: 0.3 }),
        dusk: createArchMaterial({ color: 0x8e7f9e, roughness: 0.9, variation: 0.25 }),
        far: createArchMaterial({ color: 0x9a8aa8, roughness: 1, variation: 0.15 }),
        gold: createArchMaterial({ color: 0xc8a467, roughness: 0.3, metalness: 0.8, variation: 0.2 }),
        glow: createGlowMaterial(0xffc98f, 3.5, 0.3, 0.6),
        windows: createGlowMaterial(0xffb066, 0.0, 0.2, 0.4),
      },
      {
        sky: {
          top: 0x1d2a55,
          horizon: 0xf0a067,
          bottom: 0xb07a86,
          sunDirection: sunDir,
          sunColor: 0xffb070,
          sunSize: 0.0016,
          sunGlow: 2.2,
          clouds: 0.6,
          cloudColor: 0xffb98c,
          cloudShadow: 0x6e5d8c,
          horizonOffset: -0.01,
        },
        fogDensity: 0.00042,
        sunIntensity: 3.6,
        hemiSky: 0x8f8cc0,
        hemiGround: 0x5c3f40,
        hemiIntensity: 0.55,
        environmentIntensity: 0.55,
        exposure: 0.85,
        bloom: 0.55,
        shadowRange: 90,
        vignette: 0.42,
        saturation: 1.05,
      },
    );
    const { b } = kit;

    // Two cloud layers: a solid ocean, and a thin moving veil above it.
    b.add(createCloudLayer({ y: -40, lit: 0xffb487, shadow: 0x6a5a8e, horizon: 0xe4977a, sunDirection: sunDir, cover: 0.32, scale: 0.0028, wind: 0.8, octaves: ctx.quality.cloudOctaves, fadeEnd: 4200 }));
    b.add(createCloudLayer({ y: -12, lit: 0xffd2b0, shadow: 0x8a78a6, horizon: 0xe4977a, sunDirection: sunDir, cover: 0.62, opacity: 0.55, scale: 0.006, wind: 2.2, octaves: Math.max(3, ctx.quality.cloudOctaves - 1), fadeEnd: 2600 }));

    // --- The terrace where you arrive ----------------------------------------------
    platform(b, { x: 0, y: 0, z: 0, width: 46, depth: 36, thickness: 4, mat: 'stone', keel: 40, edgeMat: 'gold' });
    b.box(-23, 0, 0, 0.6, 1.1, 36, 'warm');
    b.box(23, 0, 0, 0.6, 1.1, 36, 'warm');
    b.box(0, 0, 18, 46, 1.1, 0.6, 'warm');
    b.box(-14, 0, -18, 18, 1.1, 0.6, 'warm');
    b.box(14, 0, -18, 18, 1.1, 0.6, 'warm');
    colonnade(b, { start: v3(-20, 0, 14), direction: v3(1, 0, 0), count: 9, spacing: 5, height: 9, size: 0.6, style: 'fluted', mat: 'warm', capital: true, base: true });
    b.box(0, 9, 14, 44, 1.2, 2.4, 'warm', { collide: false });
    // The arch home: a passage back to the Infinite Ascent.
    arch(b, { x: 16, z: 6, y0: 0, rotY: Math.PI / 2, span: 2.6, legHeight: 3, pier: 0.8, depth: 0.8, crown: 0.6, mat: 'gold' });
    sculpture(b, { position: v3(-12, 6, 0), size: 1.4, kind: 'nested', mat: 'gold', innerMat: 'glow', float: 0.5 });

    // --- The long bridge toward the sun, under colossal arches ------------------
    bridge(b, { from: v3(0, 0, -18), to: v3(0, 0, BRIDGE_END + 20), width: 8, mat: 'stone', railMat: 'warm', thickness: 2.2, underside: 'ribbed' });
    for (let z = -60; z > BRIDGE_END + 30; z -= 52) {
      const scale = 1 + (-z / 400) * 0.6;
      arch(b, { x: 0, z, y0: -70, span: Math.round(34 * scale), legHeight: Math.round(95 * scale), pier: Math.round(9 * scale), depth: 9, crown: 8, mat: 'stone', collide: false });
      // Keep the piers solid where they meet the deck level.
      const off = Math.round(34 * scale) / 2 + Math.round(9 * scale) / 2;
      b.collideBox(off, -70, z, Math.round(9 * scale), 200, 9);
      b.collideBox(-off, -70, z, Math.round(9 * scale), 200, 9);
    }
    // Pylons under the bridge falling into the clouds.
    for (let z = -40; z > BRIDGE_END; z -= 26) b.box(0, -90, z, 5, 88, 5, 'dusk', { collide: false, castShadow: false });

    // The largest arch, with the hidden inscription beneath it.
    const big = { z: -110 };
    arch(b, { x: 0, z: big.z, y0: -2.2, span: 18, legHeight: 26, pier: 6, depth: 12, crown: 6, mat: 'warm' });
    // A low stone lectern on the deck, directly under the crown.
    b.box(-2.9, 0, big.z, 0.7, 1.0, 1.2, 'dusk');
    b.box(-2.9, 1.0, big.z, 0.5, 0.03, 0.9, 'glow', { collide: false, castShadow: false });
    b.box(0, 0.01, big.z, 2.2, 0.02, 2.2, 'gold', { collide: false, castShadow: false });

    // --- The observation platform ---------------------------------------------
    const O = { z: BRIDGE_END };
    platform(b, { x: 0, y: 0, z: O.z, width: 40, depth: 40, thickness: 3, mat: 'stone', keel: 46, edgeMat: 'gold' });
    for (const side of [-1, 1]) b.box(side * 20, 0, O.z, 0.6, 1.1, 40, 'warm');
    b.box(0, 0, O.z - 20, 40, 1.1, 0.6, 'warm');
    b.box(-13, 0, O.z + 20, 14, 1.1, 0.6, 'warm');
    b.box(13, 0, O.z + 20, 14, 1.1, 0.6, 'warm');
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) pillar(b, { x: side * 17, z: O.z + 15 - i * 10, y0: 0, height: 6, size: 0.5, style: 'round', mat: 'warm', capital: true });
    ring(b, { center: v3(0, 22, O.z - 6), radius: 14, thickness: 0.4, mat: 'gold', spin: 0.04, spinAxis: v3(0, 0, 1) });
    // A secondary stair down to a lower viewing ledge.
    staircase(b, { x: 12, z: O.z - 14, y0: -6, facing: 3, width: 3, steps: 24, rise: 0.25, tread: 0.5, mat: 'warm', slab: 0.5 });
    platform(b, { x: 3, y: -6, z: O.z - 14, width: 6, depth: 6, mat: 'stone', keel: 6 });

    // Floating sculptures above the clouds near the bridge.
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      sculpture(b, {
        position: v3(side * rng.range(40, 120), rng.range(10, 60), -rng.range(60, 520)),
        size: rng.range(4, 12),
        kind: rng.pick(['octahedron', 'tetrahedron', 'icosahedron', 'nested', 'shard'] as const),
        mat: rng.chance(0.3) ? 'gold' : 'warm',
        innerMat: 'glow',
        float: 3,
        spin: rng.range(0.01, 0.05),
      });
    }

    // --- Distant inverted cities hanging over the horizon --------------------------
    const cities = [v3(-1300, 380, -1700), v3(1500, 460, -2100)];
    for (const c of cities) {
      b.box(c.x, c.y, c.z, 520, 20, 360, 'far', { collide: false, castShadow: false });
      const cr = rng.fork(c.x);
      for (let i = 0; i < 40; i++) {
        hangingTower(b, { x: c.x + cr.range(-240, 240), z: c.z + cr.range(-160, 160), ceilingY: c.y, width: cr.range(14, 40), height: cr.range(60, 220), tiers: cr.int(2, 4), mat: 'far', windowMat: 'windows' });
      }
    }

    // --- The megastructure, hidden beneath the clouds until the reveal --------------
    const mega = new THREE.Group();
    // Placed so that, from the platform, the setting sun sits inside its ring.
    const megaB = { z: -1500, x: 84, y: -219 };
    const span = 1400;
    const legs = 260;
    const megaArch = new THREE.Mesh(
      b.geometry('mega-arch', () => {
        const shape = new THREE.Shape();
        const W = span / 2 + legs;
        const H = 1100;
        shape.moveTo(-W, -400);
        shape.lineTo(-span / 2, -400);
        shape.lineTo(-span / 2, 300);
        shape.absarc(0, 300, span / 2, Math.PI, 0, true);
        shape.lineTo(span / 2, -400);
        shape.lineTo(W, -400);
        shape.lineTo(W, H);
        shape.lineTo(-W, H);
        shape.lineTo(-W, -400);
        const g = new THREE.ExtrudeGeometry(shape, { depth: 160, bevelEnabled: false, curveSegments: 64 });
        g.translate(0, 0, -80);
        return g;
      }),
      b.mat('far'),
    );
    mega.add(megaArch);
    const megaRing = new THREE.Mesh(b.geometry('mega-ring', () => new THREE.TorusGeometry(380, 22, 4, 180)), b.mat('gold'));
    megaRing.position.set(0, 300, 0);
    mega.add(megaRing);
    for (let i = -6; i <= 6; i++) {
      const fin = new THREE.Mesh(b.unitBox, b.mat('far'));
      fin.scale.set(30, 300 + Math.abs(i) * 30, 30);
      fin.position.set(i * 120, 1100 + fin.scale.y / 2, 0);
      mega.add(fin);
    }
    mega.position.set(megaB.x, -1700, megaB.z);
    b.add(mega);
    let rise = 0;
    let riseTarget = 0;
    kit.onUpdate.push((dt) => {
      rise += (riseTarget - rise) * (1 - Math.exp(-dt * 0.35));
      mega.position.y = -1700 + rise * (megaB.y + 1700);
      megaRing.rotation.z += dt * 0.01;
    });
    if (ctx.services.isDiscovered('horizon-reveal')) riseTarget = rise = 1;

    // Cities answer the inscription by lighting their windows.
    const winMat = b.mat('windows') as THREE.ShaderMaterial;
    let winTarget = ctx.services.isDiscovered('horizon-inscription') ? 2.2 : 0;
    winMat.uniforms.uIntensity.value = winTarget;
    kit.onUpdate.push((dt) => {
      const u = winMat.uniforms.uIntensity;
      u.value += (winTarget - u.value) * (1 - Math.exp(-dt * 0.4));
    });

    addDust(kit, 0xffd9b8, 0.5, 0.05, 0.4);

    const portals: PortalDef[] = [
      {
        id: 'horizon-to-ascent',
        position: v3(16.1, 1.5, 6),
        rotY: -Math.PI / 2,
        width: 2.6,
        height: 3,
        label: 'Return to the Infinite Ascent',
        tint: 0xe7f0ff,
        target: { kind: 'world', worldId: 'infinite-ascent', arrival: 'from-horizon' },
      },
    ];

    const revealShot = {
      points: [v3(0, 1.7, O.z - 16), v3(0, 6, O.z - 4), v3(0, 40, O.z + 60), v3(0, 120, O.z + 260)],
      look: [v3(0, 4, O.z - 200), v3(megaB.x, 40, megaB.z), v3(megaB.x, 160, megaB.z), v3(megaB.x, 200, megaB.z)],
      duration: 16,
    };

    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: v3(0, 0, 8), yaw: 0 },
      arrivals: {
        'from-ascent': { position: v3(13.5, 0, 6), yaw: Math.PI / 2 },
        'from-house': { position: v3(0, 0, 10), yaw: 0 },
      },
      killY: -60,
      soundscape: 'horizon',
      portals,
      emitters: [{ position: v3(0, 22, O.z - 6), kind: 'hum', radius: 40, pitch: 110 }],
      triggers: [
        {
          position: v3(0, 1.7, O.z - 15),
          radius: 7,
          height: 4,
          onEnter: () => {
            const first = !ctx.services.isDiscovered('horizon-reveal');
            riseTarget = 1;
            ctx.services.sound('reveal');
            if (first || rise < 0.9) {
              if (!ctx.services.reducedMotion()) ctx.services.cameraMove(revealShot, () => ctx.services.discover('horizon-reveal'));
              else ctx.services.discover('horizon-reveal');
            }
          },
        },
      ],
      interactables: [
        {
          id: 'inscription',
          position: v3(-2.9, 1.2, big.z),
          radius: 3.2,
          label: 'Read the inscription',
          onInteract: () => {
            winTarget = winTarget > 0 ? 0 : 2.2;
            ctx.services.sound('resonance');
            ctx.services.discover('horizon-inscription');
          },
        },
      ],
      cinematic: [
        { points: [v3(-30, 4, 30), v3(-10, 6, 0), v3(4, 3, -40)], look: [v3(0, 10, -100), v3(0, 20, -200), v3(0, 30, -400)], duration: 20 },
        { points: [v3(60, -20, -80), v3(40, 10, -200), v3(30, 40, -330)], look: [v3(0, 20, -100), v3(0, 30, -220), v3(0, 0, -430)], duration: 22 },
        { points: [v3(0, 3, -360), v3(0, 2.4, -420), v3(0, 3, -445)], look: [v3(0, 6, -600), v3(40, 40, -1200), v3(megaB.x, 120, megaB.z)], duration: 16 },
        { points: [v3(-200, 80, -300), v3(-260, 140, -700), v3(-180, 240, -1100)], look: [v3(-1300, 300, -1700), v3(-1300, 300, -1700), v3(megaB.x, 200, megaB.z)], duration: 24 },
        { points: [v3(30, 30, 60), v3(0, 22, 20), v3(-30, 14, -20)], look: [v3(0, 0, -200), v3(0, 0, -300), v3(0, 10, -400)], duration: 18 },
      ],
    });
  },
};
