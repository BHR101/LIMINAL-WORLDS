import * as THREE from 'three';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { amesRoom, hyperbolicFloorMaterial, kleinBottle, mobiusStrip, penroseOffset, penroseStairs, penroseTriangle, tesseract } from '../architecture/Impossible';
import { pillar } from '../architecture/Pillars';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { PortalDef } from '../architecture/Portals';
import type { WorldDefinition } from './types';

const HALL = 40; // half-size
const ROOF = 22;

export const ContradictionGallery: WorldDefinition = {
  id: 'contradiction-gallery',
  numeral: 'II',
  name: 'The Gallery of Contradictions',
  tagline: 'Every exhibit is real. None of them is possible.',
  description:
    'A white hall of objects that cannot exist: a triangle that closes on itself, stairs that only go up, a room that makes giants of children, a painting that contains itself, a cube from the fourth dimension and a floor that never reaches its edge.',
  build(ctx) {
    const sunDir = v3(0.3, 0.9, 0.25).normalize();
    const kit = beginWorld(
      ctx,
      {
        plaster: createArchMaterial({ color: 0xe8e5df, roughness: 0.92, variation: 0.15, panel: 2.5, streaks: 0 }),
        floor: createArchMaterial({ color: 0xcfc9bf, roughness: 0.32, variation: 0.25, panel: 4, streaks: 0, scale: 0.25 }),
        dark: createArchMaterial({ color: 0x232428, roughness: 0.7, variation: 0.3 }),
        void: createArchMaterial({ color: 0x0e0f12, roughness: 1, variation: 0.1 }),
        gold: createArchMaterial({ color: 0xc6a25e, roughness: 0.3, metalness: 0.85, variation: 0.15 }),
        mirror: createArchMaterial({ color: 0xb6c0cc, roughness: 0.1, metalness: 0.95, variation: 0.05 }),
        penrose: createArchMaterial({ color: 0x2e3440, roughness: 0.45, variation: 0.08, scale: 0.6, streaks: 0 }),
        stairs: createArchMaterial({ color: 0xd9d3c8, roughness: 0.8, variation: 0.2, panel: 0.6 }),
        rose: createArchMaterial({ color: 0xbf8d86, roughness: 0.75, variation: 0.1, streaks: 0 }),
        ivory: createArchMaterial({ color: 0xf0e8dc, roughness: 0.75, variation: 0.1, streaks: 0 }),
        figure: createArchMaterial({ color: 0x34373e, roughness: 0.5, variation: 0.1 }),
        glow: createGlowMaterial(0xffe2b0, 3, 0.2, 0.6),
        glowBlue: createGlowMaterial(0x8fc8ff, 2.2, 0.3, 1.2),
      },
      {
        sky: { top: 0x8fa6bf, horizon: 0xe9e4dc, bottom: 0xbdb5aa, sunDirection: sunDir, sunColor: 0xfff4e4, sunSize: 0.0008, clouds: 0.5 },
        fogDensity: 0.004,
        sunIntensity: 2.8,
        hemiSky: 0xe8eef6,
        hemiGround: 0x9a9286,
        hemiIntensity: 0.75,
        environmentIntensity: 0.6,
        exposure: 0.76,
        bloom: 0.3,
        shadowRange: 60,
        vignette: 0.35,
      },
    );
    const { b } = kit;

    // --- The hall --------------------------------------------------------------
    const PIT = { x0: 13, x1: 36, z0: 8, z1: 32 };
    const slab = (x0: number, x1: number, z0: number, z1: number) => b.box((x0 + x1) / 2, -1, (z0 + z1) / 2, x1 - x0, 1, z1 - z0, 'floor');
    slab(-HALL, PIT.x0, -HALL, HALL);
    slab(PIT.x0, HALL, -HALL, PIT.z0);
    slab(PIT.x0, HALL, PIT.z1, HALL);
    slab(PIT.x1, HALL, PIT.z0, PIT.z1);
    // The pit: dark walls falling away into nothing.
    b.box((PIT.x0 + PIT.x1) / 2, -60, PIT.z0 - 0.5, PIT.x1 - PIT.x0, 59, 1, 'void');
    b.box((PIT.x0 + PIT.x1) / 2, -60, PIT.z1 + 0.5, PIT.x1 - PIT.x0, 59, 1, 'void');
    b.box(PIT.x0 - 0.5, -60, (PIT.z0 + PIT.z1) / 2, 1, 59, PIT.z1 - PIT.z0, 'void');
    b.box(PIT.x1 + 0.5, -60, (PIT.z0 + PIT.z1) / 2, 1, 59, PIT.z1 - PIT.z0, 'void');
    b.box((PIT.x0 + PIT.x1) / 2, -62, (PIT.z0 + PIT.z1) / 2, PIT.x1 - PIT.x0, 2, PIT.z1 - PIT.z0, 'void');
    // Low balustrade round the pit (gap where the balcony juts out).
    b.box((PIT.x0 + PIT.x1) / 2, 0, PIT.z0 - 0.2, PIT.x1 - PIT.x0, 0.95, 0.3, 'gold');
    b.box(PIT.x0 - 0.2, 0, (PIT.z0 + PIT.z1) / 2, 0.3, 0.95, PIT.z1 - PIT.z0, 'gold');
    b.box((PIT.x0 + 32.2) / 2, 0, PIT.z1 + 0.2, 32.2 - PIT.x0, 0.95, 0.3, 'gold');
    b.box(PIT.x1 + 0.2, 0, (PIT.z0 + 26.2) / 2, 0.3, 0.95, 26.2 - PIT.z0, 'gold');
    // Walls and a roof of long skylights.
    b.box(0, 0, -HALL - 0.5, HALL * 2 + 2, ROOF, 1, 'plaster');
    b.box(0, 0, HALL + 0.5, HALL * 2 + 2, ROOF, 1, 'plaster');
    b.box(-HALL - 0.5, 0, 0, 1, ROOF, HALL * 2, 'plaster');
    b.box(HALL + 0.5, 0, 0, 1, ROOF, HALL * 2, 'plaster');
    for (let x = -HALL; x < HALL; x += 10) b.box(x + 3.5, ROOF, 0, 7, 1.2, HALL * 2 + 2, 'plaster', { collide: false });
    for (let z = -HALL + 10; z < HALL; z += 20) b.box(0, ROOF - 1.2, z, HALL * 2, 1.2, 0.8, 'plaster', { collide: false });
    for (const x of [-HALL + 0.6, HALL - 0.6]) for (let z = -HALL + 8; z < HALL; z += 16) pillar(b, { x, z, y0: 0, height: ROOF, size: 0.6, mat: 'plaster' });

    // --- Exhibit 1: the hyperbolic floor and the hypercube above it -----------------
    const hyper = new THREE.Mesh(new THREE.CircleGeometry(9, 96), hyperbolicFloorMaterial(0xf0e9de, 0x2c2f36, 0xc6a25e));
    hyper.rotation.x = -Math.PI / 2;
    hyper.position.set(0, 0.015, 4);
    hyper.receiveShadow = false;
    b.add(hyper);
    const rim = new THREE.Mesh(new THREE.RingGeometry(9, 9.35, 96), b.mat('gold'));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(0, 0.02, 4);
    b.add(rim);
    const cube4 = tesseract(b, v3(0, 6, 4), 2.3, 'glowBlue', 'gold');
    let hyperSpeed = 0.35;
    let boost = 0;
    kit.onUpdate.push((dt) => {
      boost = Math.max(0, boost - dt);
      hyperSpeed += ((boost > 0 ? 2.6 : 0.35) - hyperSpeed) * (1 - Math.exp(-dt));
      cube4.update(dt, hyperSpeed);
    });

    // --- Exhibit 2: the Penrose triangle ---------------------------------------------
    const V1 = v3(-14, 1.65, 22);
    const tri = penroseTriangle(b, { viewpoint: V1, heading: 0, distance: 26, length: 12, rise: 0.5, thickness: 1.7, mat: 'penrose' });
    b.box(V1.x, 0, V1.z, 1.2, 0.03, 1.2, 'glow', { collide: false, castShadow: false });

    // --- Exhibit 3: the stairs that only go up -----------------------------------
    const V2 = v3(32.6, 1.65, 26.6);
    const D = penroseOffset(12, 3);
    const S = V2.clone().addScaledVector(D, -1.95);
    const stairs = penroseStairs(b, { start: S, width: 3, longSteps: 12, shortSteps: 3, mat: 'stairs', landingMat: 'stairs' });
    // A soft light hung over the stairs so they glow white against the dark pit.
    const pitLight = new THREE.PointLight(0xfff1dc, 45, 45, 1.6);
    pitLight.position.copy(S).add(v3(5, 14, 5));
    b.add(pitLight);
    // Balcony jutting over the pit to the one spot where the loop closes.
    b.box(34.1, -0.5, 29.1, 3.8, 0.5, 5.8, 'floor');
    b.box(34.1, 0, 26.05, 3.8, 0.85, 0.15, 'gold');
    b.box(32.05, 0, 29.1, 0.15, 0.85, 5.8, 'gold');
    b.box(V2.x, 0, V2.z, 0.9, 0.03, 0.9, 'glow', { collide: false, castShadow: false });

    // --- Exhibit 4: the Ames room -----------------------------------------------
    const V3 = v3(22, 3.05, -10);
    b.box(22, 0, -7.6, 4, 1.4, 4.4, 'floor');
    for (let i = 0; i < 4; i++) b.box(22, 0, -5.175 + 0.45 * (3 - i), 2.4, 0.35 * (i + 1), 0.45, 'floor');
    const ames = amesRoom(b, {
      viewpoint: V3,
      width: 8,
      depth: 8,
      height: 3.6,
      strength: 0.11,
      mats: { floorA: 'rose', floorB: 'ivory', wall: 'plaster', trim: 'figure', figure: 'figure' },
    });
    kit.onUpdate.push((_dt, t) => ames.update(t));
    b.box(V3.x, 1.4, V3.z + 0.35, 0.6, 0.03, 0.6, 'glow', { collide: false, castShadow: false });

    // --- Exhibit 5: the painting that contains itself -------------------------------
    const F = v3(0, 2.6, -HALL + 0.75); // the portal box (0.7 m deep) must sit in front of the wall
    for (const sx of [-1, 1]) b.box(F.x + sx * 3.75, 0, F.z + 0.2, 0.5, 5.6, 0.4, 'gold');
    b.box(F.x, 5.1, F.z + 0.2, 8, 0.5, 0.4, 'gold');
    b.box(F.x, 0, F.z + 0.6, 8, 0.12, 1.2, 'gold', { collide: false });
    // Things in front of the painting, so each nested copy reads as a deeper tunnel.
    b.box(F.x, 0.005, F.z + 10, 3.2, 0.02, 20, 'rose', { collide: false, castShadow: false });
    for (const sx of [-1, 1]) for (const dz of [6, 14]) b.box(F.x + sx * 5, 0, F.z + dz, 1.1, 6.5, 1.1, 'figure');
    b.box(F.x, 7.6, F.z + 10, 0.12, 0.12, 16, 'glow', { collide: false, castShadow: false });

    // --- Exhibit 6 & 7: surfaces with only one side ---------------------------------
    b.box(-24, 0, -22, 3, 1.2, 3, 'dark');
    const kb = kleinBottle(b, v3(-24, 5.2, -22), 5, 'mirror');
    b.box(-30, 0, 32, 2.4, 1.2, 2.4, 'dark');
    const mb = mobiusStrip(b, v3(-30, 4.2, 32), 2.2, 'gold');
    kit.onUpdate.push((dt) => {
      kb.rotation.y += dt * 0.12;
      mb.rotation.y -= dt * 0.18;
      mb.rotation.x = 0.4;
    });

    addDust(kit, 0xffffff, 0.35, 0.03, 0.3);

    const portals: PortalDef[] = [
      {
        id: 'endless-stair',
        position: stairs.portal.position,
        rotY: -Math.PI / 2,
        width: stairs.portal.width,
        height: stairs.portal.height,
        label: 'Keep climbing',
        tint: 0xfff3dc,
        target: { kind: 'local', position: stairs.portal.target, rotY: -Math.PI / 2 },
      },
      {
        id: 'droste',
        position: F,
        rotY: 0,
        width: 7,
        height: 5,
        label: 'Step into the painting',
        discovery: 'gallery-droste',
        tint: 0xc6a25e,
        recursive: true,
        target: { kind: 'local', position: F.clone().add(v3(0, 0, 20)), rotY: 0 },
      },
    ];

    let laps = 0;
    const L = stairs.landings;
    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: v3(0, 0, 34), yaw: 0 },
      killY: -50,
      soundscape: 'gallery',
      portals,
      emitters: [{ position: v3(0, 6, 4), kind: 'hum', radius: 22, pitch: 130.8 }],
      discoveries: [
        { id: 'gallery-penrose', position: V1, radius: 1.0, mode: 'view', lookAt: tri.center },
        { id: 'gallery-stairs-view', position: V2, radius: 0.9, mode: 'view', lookAt: S },
        { id: 'gallery-ames', position: V3, radius: 0.9, mode: 'view', lookAt: V3.clone().add(v3(0, -0.4, -6)) },
      ],
      triggers: [
        {
          position: L[1].clone().add(v3(0, 1.6, 0)),
          radius: 1.6,
          height: 2,
          once: false,
          onEnter: () => {
            laps++;
            if (laps >= 3) ctx.services.discover('gallery-endless');
          },
        },
      ],
      interactables: [
        {
          id: 'hypercube',
          position: v3(0, 1.6, 4),
          radius: 4,
          label: 'Turn the hypercube through the fourth dimension',
          onInteract: () => {
            boost = 12;
            ctx.services.sound('resonance');
            ctx.services.discover('gallery-tesseract');
          },
        },
        {
          id: 'descend',
          position: v3(V2.x + 0.6, 1.6, V2.z + 1.5),
          radius: 2.2,
          label: 'Step down onto the stairs',
          onInteract: () => ctx.services.teleport(L[0].clone().add(v3(-0.6, 0, 0)), -Math.PI / 2),
        },
        {
          id: 'ascend',
          position: L[2].clone().add(v3(0, 1.6, 0)),
          radius: 2,
          label: 'Return to the gallery',
          onInteract: () => ctx.services.teleport(v3(V2.x + 1, 0, V2.z + 2.5), Math.PI * 0.75),
        },
      ],
      cinematic: [
        { points: [v3(0, 1.8, 36), v3(2, 3, 20), v3(5, 4, 12)], look: [v3(0, 4, 4), v3(0, 5, 4), v3(0, 6, 4)], duration: 18 },
        { points: [v3(-4, 3, 28), v3(-10, 2.2, 24), V1.clone()], look: [tri.center, tri.center, tri.center], duration: 16 },
        { points: [v3(24, 6, 36), v3(30, 3, 30), V2.clone()], look: [S, S, S], duration: 16 },
        { points: [v3(18, 4, -2), v3(21, 3.3, -7), V3.clone()], look: [v3(22, 3, -16), v3(22, 3, -16), v3(22, 2.7, -16)], duration: 14 },
        { points: [v3(0, 2.6, -2), v3(0, 2.6, -14), v3(0, 2.6, -26)], look: [v3(0, 2.6, -40), v3(0, 2.6, -40), v3(0, 2.6, -40)], duration: 16 },
      ],
    });
  },
};
