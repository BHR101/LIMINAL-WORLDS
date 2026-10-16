import * as THREE from 'three';
import { RNG } from '../core/rng';
import { arch } from '../architecture/Arches';
import { pillar, colonnade } from '../architecture/Pillars';
import { corridor, room, ring, sculpture, platform } from '../architecture/Structures';
import { skyline } from '../architecture/Towers';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { createWater } from '../rendering/Water';
import { createLightShaft } from '../rendering/Effects';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { PortalDef } from '../architecture/Portals';
import type { WorldDefinition } from './types';

const FLOOR = -0.4;
const HALL_X = 2600; // the chapel's interior lives far out in the fog

export const SunkenCathedral: WorldDefinition = {
  id: 'sunken-cathedral',
  numeral: 'I',
  name: 'The Sunken Cathedral',
  tagline: 'Concrete, water, and light that arrives from very far away.',
  description:
    'A brutalist nave standing in an endless shallow sea. Columns march past the end of the roof and keep going, reflected, into the fog.',
  build(ctx) {
    const rng = new RNG(ctx.seed || 101);
    const sunDir = v3(0.55, 0.75, 0.37).normalize();
    const kit = beginWorld(
      ctx,
      {
        concrete: createArchMaterial({ color: 0x5d5f61, roughness: 0.92, panel: 1.2, streaks: 0.4, variation: 0.7 }),
        stone: createArchMaterial({ color: 0x8e8a83, roughness: 0.85, variation: 0.5, scale: 0.25 }),
        floor: createArchMaterial({ color: 0x3b4144, roughness: 0.55, variation: 0.6, scale: 0.3, panel: 2.4, streaks: 0 }),
        distant: createArchMaterial({ color: 0x777d82, roughness: 0.95, variation: 0.25 }),
        sculpt: createArchMaterial({ color: 0x2e2c2a, roughness: 0.28, metalness: 0.85, variation: 0.3 }),
        ivory: createArchMaterial({ color: 0xb9ae9e, roughness: 0.8, variation: 0.4, panel: 0.9 }),
        polished: createArchMaterial({ color: 0x4a4744, roughness: 0.18, metalness: 0.1, variation: 0.35, panel: 3, streaks: 0 }),
        glow: createGlowMaterial(0xffe2b0, 5, 0.25, 1.4),
      },
      {
        sky: {
          top: 0x5c7183,
          horizon: 0xa7b0b4,
          bottom: 0x5a656c,
          sunDirection: sunDir,
          sunColor: 0xfff0d6,
          sunSize: 0.0008,
          clouds: 0.55,
          cloudColor: 0xeeebe4,
          cloudShadow: 0x8a939a,
        },
        fogDensity: 0.0052,
        sunIntensity: 3.1,
        hemiSky: 0xb7c4cf,
        hemiGround: 0x30363a,
        hemiIntensity: 0.45,
        environmentIntensity: 0.55,
        exposure: 0.95,
        bloom: 0.3,
        shadowRange: 90,
        vignette: 0.4,
      },
    );
    const { b } = kit;

    // Sea floor and the water above it.
    b.box(0, FLOOR - 2, -200, 3000, 2, 3400, 'floor');
    const water = createWater({
      width: 3000,
      depth: 3400,
      color: 0x1b262d,
      opacity: 0.72,
      reflectivity: 0.92,
      distortion: 0.025,
      resolutionScale: ctx.quality.reflectionScale,
    });
    water.position.set(0, 0, -200);
    b.add(water);

    // --- The nave: transverse arches whose piers are the columns -----------------
    const naveZ: number[] = [];
    for (let i = 0; i < 20; i++) naveZ.push(92 - i * 12);
    for (const z of naveZ) {
      arch(b, { x: 0, z, y0: FLOOR, span: 31.6, legHeight: 30, pier: 4.4, depth: 4.4, crown: 3, mat: 'concrete' });
      for (const sx of [-18, 18]) b.box(sx, FLOOR, z, 6.2, 1.4, 6.2, 'stone');
    }
    // Longitudinal arcades forming the nave walls.
    for (let i = 0; i < naveZ.length - 1; i++) {
      const zm = naveZ[i] - 6;
      for (const sx of [-18, 18]) {
        arch(b, { x: sx, z: zm, y0: FLOOR, rotY: Math.PI / 2, span: 7.6, legHeight: 14, pier: 4.4, depth: 2.6, crown: 6.6, mat: 'concrete' });
      }
    }
    // The broken vault: slabs between arches, some missing so the sun gets in.
    const vaultTop = FLOOR + 30 + 15.8 + 3;
    const gaps: THREE.Vector3[] = [];
    for (let i = 0; i < naveZ.length - 1; i++) {
      const zm = naveZ[i] - 6;
      const r = rng.next();
      if (i === 3 || i === 7 || i === 12 || (r < 0.3 && i > 1)) {
        gaps.push(v3(rng.range(-6, 6), vaultTop, zm));
        if (r < 0.15) b.box(-13, vaultTop - 2, zm, 14, 2, 7.8, 'concrete', { collide: false });
        continue;
      }
      b.box(0, vaultTop - 2, zm, 40, 2, 7.8, 'concrete', { collide: false });
      // Coffers under each slab.
      for (const cx of [-10, 0, 10]) b.box(cx, vaultTop - 3, zm, 6, 1, 5, 'concrete', { collide: false, castShadow: false });
    }

    // Side aisles with lower columns and fragments of roof.
    for (const sx of [-42, 42]) {
      naveZ.forEach((z, i) => {
        if (sx === -42 && i === 5) return; // the hollow pillar, built below
        pillar(b, { x: sx, z, y0: FLOOR, height: 26.4, size: 2, mat: 'concrete', base: true, capital: true });
      });
      for (let i = 0; i < naveZ.length - 1; i++) {
        if (rng.chance(0.45)) continue;
        b.box(sx / 2 + Math.sign(sx) * 10, FLOOR + 24.4, naveZ[i] - 6, 24, 1.6, 12.2, 'concrete', { collide: false });
      }
    }

    // The hollow pillar (west row, sixth from the facade): a slit leads inside.
    {
      const cx = -42;
      const cz = naveZ[5];
      const h = 26.4;
      b.box(cx, FLOOR, cz - 1.8, 4, h, 0.4, 'concrete');
      b.box(cx, FLOOR, cz + 1.8, 4, h, 0.4, 'concrete');
      b.box(cx + 1.8, FLOOR, cz, 0.4, h, 3.2, 'concrete');
      // West face with a slit 1.1 m wide.
      b.box(cx - 1.8, FLOOR, cz - 1.12, 0.4, h, 1.15, 'concrete');
      b.box(cx - 1.8, FLOOR, cz + 1.12, 0.4, h, 1.15, 'concrete');
      b.box(cx - 1.8, FLOOR + 3.2, cz, 0.4, h - 3.2, 1.1, 'concrete');
      b.box(cx, FLOOR, cz, 3.2, 0.5, 3.2, 'stone'); // dry floor inside
      b.box(cx, FLOOR + h - 0.6, cz, 3.2, 0.6, 3.2, 'concrete', { collide: false });
      b.box(cx, FLOOR + 3.6, cz - 1.55, 2.4, 0.06, 0.06, 'glow', { collide: false, castShadow: false });
    }

    // Facade wall with the narrow corridor through it.
    b.box(-29.25, FLOOR, 102, 54.5, 56, 4, 'concrete');
    b.box(29.25, FLOOR, 102, 54.5, 56, 4, 'concrete');
    b.box(0, FLOOR + 4.9, 102, 4, 51.1, 4, 'concrete');
    corridor(b, { x: 0, z: 127, y0: 0.1, axis: 'z', length: 46, width: 3, height: 4.5, mat: 'concrete', floorMat: 'stone', ribEvery: 3, skylights: true });

    // The endless colonnade: the rows carry on past the end of the roof.
    for (const sx of [-18, 18]) {
      colonnade(b, { start: v3(sx, FLOOR, -148), direction: v3(0, 0, -1), count: 34, spacing: 12, height: 36, size: 2.2, mat: 'concrete', base: true });
    }
    for (const sx of [-42, 42]) {
      colonnade(b, { start: v3(sx, FLOOR, -148), direction: v3(0, 0, -1), count: 20, spacing: 12, height: 26.4, size: 2, mat: 'concrete', base: true });
    }
    // Fallen and broken pieces in the water.
    for (let i = 0; i < 14; i++) {
      const x = rng.range(-30, 30);
      const z = rng.range(-130, 80);
      if (Math.abs(x) < 4) continue;
      b.box(x, FLOOR, z, rng.range(2, 6), rng.range(0.6, 1.6), rng.range(2, 5), 'concrete', { rotY: rng.range(0, Math.PI) * 0, collide: true });
    }

    // Floating sculptures in the nave.
    sculpture(b, { position: v3(0, 18, 40), size: 3, kind: 'nested', mat: 'sculpt', innerMat: 'glow', float: 0.8 });
    sculpture(b, { position: v3(-6, 30, -15), size: 4, kind: 'octahedron', mat: 'sculpt', float: 1.2, spin: 0.05 });
    sculpture(b, { position: v3(8, 12, -95), size: 2.5, kind: 'tetrahedron', mat: 'sculpt', float: 0.6 });
    sculpture(b, { position: v3(-9, 22, -118), size: 3, kind: 'icosahedron', mat: 'sculpt', float: 1 });
    sculpture(b, { position: v3(0, 38, -60), size: 3.5, kind: 'shard', mat: 'sculpt', float: 1.5, spin: 0.03 });

    // The Sun Stone at the crossing.
    const stone = sculpture(b, { position: v3(0, 2.4, -60), size: 0.55, kind: 'octahedron', mat: 'glow', float: 0.25, spin: 0.4 });
    ring(b, { center: v3(0, 2.4, -60), radius: 1.6, thickness: 0.06, mat: 'sculpt', spin: 0.3, spinAxis: v3(0, 1, 0.2), rotation: new THREE.Euler(Math.PI / 2, 0, 0) });
    platform(b, { x: 0, y: FLOOR + 0.3, z: -60, width: 6, depth: 6, thickness: 0.3, mat: 'stone' });

    // Light shafts through the gaps in the vault.
    const shafts: THREE.Mesh[] = [];
    for (const g of gaps) {
      const bottom = g.clone().addScaledVector(sunDir, -(g.y / sunDir.y));
      const shaft = createLightShaft(g, bottom, 3.5, 5.5, 0xffe7c4, 0.16);
      shafts.push(shaft);
      b.add(shaft);
    }

    addDust(kit, 0xfff1d8, 1, 0.045, 0.55);

    // Distant towers dissolving in the fog, and a vast ring on the horizon.
    skyline(b, rng.fork('skyline'), { cx: 0, cz: -100, inner: 380, outer: 950, count: 46, minH: 60, maxH: 280, mat: 'distant', y0: FLOOR });
    ring(b, { center: v3(0, 80, -760), radius: 85, thickness: 5, mat: 'distant', spin: 0.02, spinAxis: v3(0, 1, 0) });

    // --- "Larger Within": the chapel and the hall inside it ----------------------
    const chapel = { x: 66, z: -30 };
    room(b, {
      x: chapel.x,
      z: chapel.z,
      y0: FLOOR,
      width: 4,
      depth: 5,
      height: 4.4,
      wall: 0.4,
      mat: 'ivory',
      openings: [{ side: 'w', width: 1.4, height: 2.5 }],
    });
    b.box(chapel.x, FLOOR + 4.4, chapel.z, 5.4, 0.5, 6.4, 'stone', { collide: false });
    b.box(chapel.x, FLOOR + 4.9, chapel.z, 3.4, 1.4, 6.4, 'stone', { collide: false });
    const chapelDoor = v3(chapel.x - 2.0 - 0.4 - 0.02, FLOOR + 1.25, chapel.z);

    // The hall: roofless, colossal, crossed by beams that stripe the floor with light.
    const H = { x: HALL_X, z: 0, w: 72, d: 170, h: 84 };
    b.box(H.x, FLOOR - 1, H.z, H.w + 8, 1, H.d + 8, 'polished');
    b.box(H.x - H.w / 2 - 2, FLOOR, H.z, 4, H.h, H.d + 8, 'concrete');
    b.box(H.x + H.w / 2 + 2, FLOOR, H.z, 4, H.h, H.d + 8, 'concrete');
    b.box(H.x, FLOOR, H.z - H.d / 2 - 2, H.w, H.h, 4, 'concrete');
    b.box(H.x, FLOOR, H.z + H.d / 2 + 2, H.w, H.h, 4, 'concrete');
    for (let z = -H.d / 2 + 10; z <= H.d / 2 - 10; z += 16) {
      for (const sx of [-22, 22]) pillar(b, { x: H.x + sx, z: H.z + z, y0: FLOOR, height: H.h - 6, size: 2.6, style: 'round', mat: 'stone', base: true, capital: true });
    }
    for (let z = -H.d / 2; z <= H.d / 2; z += 7) b.box(H.x, FLOOR + H.h - 6, H.z + z, H.w, 3, 2.2, 'concrete', { collide: false });
    sculpture(b, { position: v3(H.x, 30, H.z - 40), size: 9, kind: 'nested', mat: 'sculpt', innerMat: 'glow', float: 1.5, spin: 0.04 });
    ring(b, { center: v3(H.x, 40, H.z - H.d / 2 + 2), radius: 26, thickness: 1.6, mat: 'ivory', spin: 0.03 });
    const hallDoor = v3(H.x - H.w / 2 + 0.05, FLOOR + 1.25, H.z);
    // The door frame visible inside the hall.
    b.box(hallDoor.x + 0.3, FLOOR, H.z - 1.1, 0.6, 2.9, 0.6, 'ivory', { collide: false });
    b.box(hallDoor.x + 0.3, FLOOR, H.z + 1.1, 0.6, 2.9, 0.6, 'ivory', { collide: false });
    b.box(hallDoor.x + 0.3, FLOOR + 2.6, H.z, 0.6, 0.4, 2.8, 'ivory', { collide: false });

    const portals: PortalDef[] = [
      {
        id: 'chapel-door',
        position: chapelDoor,
        rotY: -Math.PI / 2,
        width: 1.4,
        height: 2.5,
        label: 'Step into the chapel',
        discovery: 'cathedral-chapel',
        target: { kind: 'local', position: v3(hallDoor.x + 0.35, hallDoor.y, hallDoor.z), rotY: -Math.PI / 2 },
      },
      {
        id: 'hall-door',
        position: v3(hallDoor.x + 0.05, hallDoor.y, hallDoor.z),
        rotY: Math.PI / 2,
        width: 1.4,
        height: 2.5,
        label: 'Return to the shallows',
        target: { kind: 'local', position: v3(chapelDoor.x - 0.3, chapelDoor.y, chapelDoor.z), rotY: Math.PI / 2 },
      },
      {
        id: 'hollow-pillar',
        position: v3(-40.55 - 0.05, FLOOR + 0.5 + 1.3, naveZ[5]),
        rotY: -Math.PI / 2,
        width: 1.5,
        height: 2.6,
        label: 'Pass into the city of black glass',
        tint: 0x7f8cff,
        target: { kind: 'world', worldId: 'obsidian-city', arrival: 'from-cathedral' },
      },
    ];

    // Sun Stone: toggles a golden light through the vault.
    const atm = kit.atm;
    let golden = 0;
    let goldenTarget = 0;
    const baseFog = atm.fog.color.clone();
    const goldFog = new THREE.Color(0xc9b28f);
    const baseSun = atm.sun.color.clone();
    const goldSun = new THREE.Color(0xffc27a);
    kit.onUpdate.push((dt) => {
      golden += (goldenTarget - golden) * (1 - Math.exp(-dt * 0.8));
      atm.sun.intensity = atm.baseSunIntensity * (1 + golden * 0.6);
      atm.sun.color.copy(baseSun).lerp(goldSun, golden);
      atm.fog.color.copy(baseFog).lerp(goldFog, golden * 0.6);
      atm.sky.material.uniforms.uHorizon.value.copy(atm.fog.color);
      for (const s of shafts) (s.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 0.16 * (1 + golden * 1.8);
      (water.material as THREE.ShaderMaterial).uniforms.uTint.value.setRGB(1, 1 - golden * 0.08, 1 - golden * 0.25);
      stone.scale.setScalar(1 + golden * 0.25);
    });

    const N = naveZ;
    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: v3(0, 0.1, 146), yaw: 0 },
      arrivals: {
        'from-obsidian': { position: v3(-42, FLOOR + 0.5, N[5]), yaw: Math.PI / 2 },
        default: { position: v3(0, 0.1, 146), yaw: 0 },
      },
      killY: -40,
      soundscape: 'cathedral',
      portals,
      emitters: [
        { position: v3(0, 2.4, -60), kind: 'hum', radius: 28, pitch: 110 },
        { position: v3(H.x, 30, H.z - 40), kind: 'hum', radius: 90, pitch: 55 },
      ],
      discoveries: [
        { id: 'cathedral-reveal', position: v3(0, 0, 95), radius: 5, mode: 'proximity' },
        { id: 'cathedral-hollow-pillar', position: v3(-42, 0, N[5]), radius: 1.6, mode: 'proximity' },
      ],
      interactables: [
        {
          id: 'sunstone',
          position: v3(0, 1.6, -60),
          radius: 4.5,
          label: 'Touch the Sun Stone',
          onInteract: () => {
            goldenTarget = goldenTarget > 0.5 ? 0 : 1;
            ctx.services.sound('resonance');
            ctx.services.discover('cathedral-sunstone');
          },
        },
      ],
      cinematic: [
        { points: [v3(0, 2.2, 88), v3(2, 3.5, 30), v3(-1, 5, -40), v3(0, 7, -120)], look: [v3(0, 6, 40), v3(0, 10, -40), v3(0, 14, -120), v3(0, 12, -260)], duration: 26 },
        { points: [v3(34, 2, 60), v3(30, 12, 10), v3(26, 26, -50)], look: [v3(0, 14, 30), v3(0, 20, -20), v3(0, 30, -100)], duration: 20 },
        { points: [v3(-170, 14, 160), v3(-150, 18, 40), v3(-120, 26, -90)], look: [v3(0, 26, 40), v3(0, 28, -20), v3(0, 30, -80)], duration: 24 },
        { points: [v3(8, 1.2, -170), v3(0, 1.6, -260), v3(-8, 2.4, -360)], look: [v3(0, 8, -260), v3(0, 10, -400), v3(0, 20, -700)], duration: 22 },
        { points: [v3(14, 8, 66), v3(10, 16, 60), v3(2, 24, 48)], look: [v3(0, 18, 40), v3(0, 22, 20), v3(-6, 30, -15)], duration: 18 },
      ],
    });
  },
};
