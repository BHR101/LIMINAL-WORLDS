import * as THREE from 'three';
import { LATTICE4_GLSL, lattice4SDF } from '../rendering/Fractals';
import { createRaymarchLayer } from '../rendering/Raymarch';
import { createGlowMaterial, createArchMaterial } from '../rendering/Materials';
import { tesseract } from '../architecture/Impossible';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { CinematicShot, WorldDefinition } from './types';

/** Position of the slice along the fourth axis (advances over time). */
let sliceW = 0.37;
const field = (p: THREE.Vector3) => lattice4SDF(p.x, p.y, p.z, sliceW);

/** Where three of the greatest tunnels cross: permanently open whatever the slice. */
const CORE = new THREE.Vector3(13.5, 13.5, 13.5);

export const RecursiveMachine: WorldDefinition = {
  id: 'recursive-machine',
  numeral: 'III',
  name: 'The Recursive Machine',
  tagline: 'A computer whose walls are a slice through four dimensions.',
  description:
    'Impossible computer architecture: a lattice of chips and buses carved at every power of three in four dimensions. You see a 3D slice of it; as the slice drifts along the fourth axis the machine rewires itself around you. At its heart turns a cube from the fourth dimension.',
  build(ctx) {
    sliceW = 0.37;
    const sunDir = v3(-0.3, 0.8, 0.5).normalize();
    const fogColor = 0x05070b;
    const kit = beginWorld(
      ctx,
      {
        glowCyan: createGlowMaterial(0x46d8ff, 1.5, 0.5, 2.5),
        brass: createArchMaterial({ color: 0xb08a4a, roughness: 0.3, metalness: 0.9, variation: 0.1 }),
      },
      {
        sky: { top: 0x020306, horizon: fogColor, bottom: 0x020203, sunDirection: sunDir, sunColor: 0x7fb6ff, sunSize: 0.0003, sunGlow: 0.2, stars: 0.7 },
        fogDensity: 0.002,
        sunIntensity: 0.6,
        hemiSky: 0x223044,
        hemiGround: 0x050505,
        hemiIntensity: 0.4,
        exposure: 1.15,
        bloom: 0.75,
        vignette: 0.5,
      },
    );
    kit.atm.sun.castShadow = false;
    const q = ctx.quality;
    const layer = createRaymarchLayer({
      steps: q.preset === 'performance' ? 64 : q.preset === 'balanced' ? 90 : 128,
      maxDistance: 220,
      fogColor,
      fogDensity: 0.011,
      sunDirection: sunDir,
      shadowSteps: q.preset === 'cinematic' ? 22 : 0,
      uniforms: {
        uW4: { value: sliceW },
        uTrace: { value: new THREE.Color(0x3fd2ff) },
        uData: { value: new THREE.Color(0xffb04a) },
        uSurge: { value: 0 },
      },
      glsl: /* glsl */ `
        uniform float uW4;
        uniform vec3 uTrace, uData;
        uniform float uSurge;
        ${LATTICE4_GLSL}
        float sceneSigma(vec3 ro) { return 1.0; }
        float sceneMap(vec3 p, float sigma, float t, out float id) { return lattice4Map(p, uW4, t, id); }
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // One layer of wiring at a given cell size: some cells carry a trace, pulses run along them.
        vec2 traces(vec2 uv, float cellSize, float t, float seed) {
          vec2 q = uv / cellSize;
          vec2 cell = floor(q);
          float hsh = h21(cell + seed);
          vec2 f = fract(q) - 0.5;
          float along = hsh > 0.5 ? f.y : f.x;
          float pos = hsh > 0.5 ? q.x : q.y;
          // Pixel footprint from ray distance (derivatives are unreliable after a ray-march loop).
          float px = t * 0.0016 / cellSize + 1e-4;
          float w = 0.035;
          float line = (1.0 - smoothstep(w, w + px * 1.5, abs(along))) * step(0.3, hsh);
          // Fade a layer out once its lines are thinner than a pixel.
          line *= 1.0 - smoothstep(0.08, 0.25, px);
          float pulse = smoothstep(0.9, 1.0, fract(pos * 0.25 - uTime * (0.5 + hsh) + hsh * 9.0));
          // Solder pads at trace ends.
          float pad = (1.0 - smoothstep(0.08, 0.08 + px * 2.0, length(f - vec2(0.0, 0.0)))) * step(0.82, hsh);
          return vec2(max(line, pad), line * pulse);
        }
        vec3 sceneShade(vec3 p, vec3 n, vec3 rd, float t, float id, float ao, float sh, float sigma) {
          // Faces carved by the moving w-slice are tinted: they are the parts that rewire.
          vec3 base = id >= 9.0 ? vec3(0.07, 0.06, 0.05) : vec3(0.045, 0.05, 0.06) + vec3(0.012) * mod(id + 3.0, 3.0);
          float dif = max(dot(n, uSun), 0.0) * sh;
          vec3 col = base * (vec3(0.6, 0.75, 1.0) * dif * 1.5 + vec3(0.3, 0.38, 0.5) * (0.5 + 0.5 * n.y) * ao);
          vec3 a = abs(n);
          vec2 uv = a.x > a.y && a.x > a.z ? p.yz : (a.y > a.z ? p.xz : p.xy);
          vec2 t1 = traces(uv, 1.0, t, 0.0);
          vec2 t2 = traces(uv, 4.0, t, 17.0);
          vec2 t3 = traces(uv, 16.0, t, 41.0);
          float line = max(t1.x, max(t2.x, t3.x));
          float pulse = max(t1.y, max(t2.y, t3.y));
          col += uTrace * line * (0.35 + 0.9 * ao);
          col += uData * pulse * (2.5 + uSurge * 4.0);
          col += uData * (id >= 9.0 ? 0.04 : 0.0) * ao * (1.0 + uSurge * 6.0);
          return col;
        }`,
    });
    kit.b.add(layer);

    const core = CORE.clone();
    const spawn = core.clone().add(v3(0, 0, 12));
    const toCore = core.clone().sub(spawn).normalize();

    const hyper = tesseract(kit.b, core, 1.6, 'glowCyan', 'brass');
    const halo = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.04, 6, 128), kit.b.mat('glowCyan'));
    halo.position.copy(core);
    kit.b.add(halo);
    let surge = 0;
    kit.onUpdate.push((dt, t) => {
      sliceW += dt * (0.06 + surge * 0.9);
      layer.material.uniforms.uW4.value = sliceW;
      hyper.update(dt, 0.6 + surge * 2);
      halo.rotation.set(t * 0.21, t * 0.13, 0);
      surge = Math.max(0, surge - dt * 0.15);
      layer.material.uniforms.uSurge.value = surge;
    });
    addDust(kit, 0x7fd8ff, 0.4, 0.05, 0.5);

    // Cinematic shots along the permanent tunnels (always open, whatever the slice).
    const c = core;
    const shots: CinematicShot[] = [
      { points: [c.clone().add(v3(0, 0, 52)), c.clone().add(v3(0.8, 0.6, 30)), c.clone().add(v3(0, 0, 9))], look: [c, c], duration: 20 },
      { points: [c.clone().add(v3(-48, 1, 0)), c.clone().add(v3(-24, -1, 0.5)), c.clone().add(v3(-7, 0, 0))], look: [c.clone().add(v3(10, 0, 0)), c], duration: 18 },
      { points: [c.clone().add(v3(0, -45, 0)), c.clone().add(v3(0.6, -20, 0.4)), c.clone().add(v3(0, -8, 0))], look: [c, c], duration: 18 },
      { points: [c.clone().add(v3(2, 2, 3)), c.clone().add(v3(3, -2, -3)), c.clone().add(v3(-3, 2, -2))], look: [c, c], duration: 14 },
    ];

    const yaw = Math.atan2(-toCore.x, -toCore.z);
    const pitch = Math.asin(toCore.y);
    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: spawn, yaw, pitch },
      killY: -1e9,
      soundscape: 'machine',
      renderScale: q.preset === 'cinematic' ? 0.85 : 0.7,
      cinematic: shots,
      emitters: [{ position: core, kind: 'hum', radius: 40, pitch: 55 }],
      flight: {
        sdf: field,
        afterUpdate: () => undefined,
      },
      discoveries: [{ id: 'machine-core', position: core, radius: 5, mode: 'proximity' }],
      interactables: [
        {
          id: 'core',
          position: core,
          radius: 6,
          label: 'Push the machine along the fourth axis',
          onInteract: () => {
            surge = 1;
            ctx.services.sound('reveal');
            ctx.services.discover('machine-rewire');
          },
        },
      ],
    });
  },
};
