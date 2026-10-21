import * as THREE from 'three';
import { RNG } from '../core/rng';
import { doorframe, ring, sculpture } from '../architecture/Structures';
import { createArchMaterial, createGlowMaterial } from '../rendering/Materials';
import { createWater } from '../rendering/Water';
import { addDust, beginWorld, finishWorld, v3 } from './WorldKit';
import type { PortalDef } from '../architecture/Portals';
import type { WorldDefinition } from './types';

function poolMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWake: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uWake;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz;
        float r = sin(length(p - vec2(70.0, 10.0)) * 2.2 - uTime * 1.6) * 0.5 + 0.5;
        float c = sin(p.x * 0.9 + uTime * 0.7) * sin(p.y * 0.6 - uTime * 0.5) * 0.5 + 0.5;
        vec3 deep = vec3(0.02, 0.05, 0.16);
        vec3 lit = vec3(0.25, 0.55, 1.6);
        vec3 col = mix(deep, lit, 0.25 + 0.35 * r * c + uWake * 0.35);
        col += vec3(0.4, 0.3, 1.2) * pow(r, 8.0) * (0.4 + uWake);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export const ObsidianCity: WorldDefinition = {
  id: 'obsidian-city',
  numeral: 'VI',
  name: 'The Obsidian City',
  tagline: 'A city of black glass that is only ever lit from within.',
  description:
    'Monoliths and empty courts of dark stone, threaded with lines of cold light. Its plazas hold the sky like still water.',
  build(ctx) {
    const rng = new RNG(ctx.seed || 303);
    const sunDir = v3(0.4, 0.33, -0.85).normalize();
    const glowBlue = createGlowMaterial(0x4f8cff, 4.5, 0.45, 1.2);
    const glowViolet = createGlowMaterial(0x9a6cff, 4, 0.35, 0.8);
    const glowAmber = createGlowMaterial(0xffa654, 3.5, 0.15, 0.5);
    const glows = [glowBlue, glowViolet, glowAmber];
    const pool = poolMaterial();
    const kit = beginWorld(
      ctx,
      {
        obsidian: createArchMaterial({ color: 0x0c0d11, roughness: 0.16, metalness: 0.55, variation: 0.35, scale: 0.08, streaks: 0 }),
        graphite: createArchMaterial({ color: 0x24262b, roughness: 0.7, variation: 0.5, panel: 2.5, streaks: 0.2 }),
        floor: createArchMaterial({ color: 0x15161a, roughness: 0.4, variation: 0.4, panel: 4, streaks: 0 }),
        glowBlue,
        glowViolet,
        glowAmber,
        pool,
      },
      {
        sky: {
          top: 0x04050b,
          horizon: 0x1f1b35,
          bottom: 0x07070c,
          sunDirection: sunDir,
          sunColor: 0x9a98ff,
          sunSize: 0.0007,
          sunGlow: 0.35,
          stars: 0.9,
          horizonOffset: 0.02,
        },
        fogDensity: 0.0042,
        sunIntensity: 1.1,
        hemiSky: 0x343759,
        hemiGround: 0x060608,
        hemiIntensity: 0.45,
        environmentIntensity: 0.45,
        exposure: 1.15,
        bloom: 0.7,
        shadowRange: 70,
        vignette: 0.45,
        saturation: 0.95,
      },
    );
    const { b } = kit;
    let now = 0;
    kit.onUpdate.push((_dt, t) => (now = t));

    // Ground and the polished black-glass plazas that mirror everything.
    b.box(0, -1, 0, 1700, 1, 1700, 'floor');
    const glass = createWater({ width: 1700, depth: 1700, color: 0x040509, opacity: 1, reflectivity: 0.62, distortion: 0.004, waveScale: 0.25, resolutionScale: ctx.quality.reflectionScale });
    glass.position.y = 0.01;
    b.add(glass);

    // --- The slot: a narrow canyon that opens onto the great court ---------------
    for (const sx of [-3.1, 3.1]) {
      b.box(sx, 0, 115, 3, 46, 70, 'graphite');
      b.box(sx * 0.5 + Math.sign(sx) * 0.02, 0.4, 115, 0.08, 0.08, 70, 'glowBlue', { collide: false, castShadow: false });
    }
    b.box(0, 0, 151.5, 9.2, 46, 3, 'graphite');
    for (let z = 84; z < 150; z += 6) b.box(0, 0, z, 1.6, 0.03, 0.08, 'glowBlue', { collide: false, castShadow: false });

    // --- Monolith field --------------------------------------------------------
    const lines: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let gx = -12; gx <= 12; gx++) {
      for (let gz = -12; gz <= 12; gz++) {
        const x = gx * 44 + rng.range(-8, 8);
        const z = gz * 44 + rng.range(-8, 8);
        if (Math.abs(x) < 135 && Math.abs(z) < 135) continue;
        if (Math.abs(x) < 25 && z > 0) continue;
        if (Math.abs(x + 160) < 45 && Math.abs(z + 40) < 45) continue; // reserved for the tall monolith
        if (rng.chance(0.35)) continue;
        const dist = Math.hypot(x, z);
        const w = rng.range(10, 26);
        const d = rng.range(10, 26);
        const h = rng.range(40, 90) + dist * rng.range(0.1, 0.4);
        b.box(x, 0, z, w, h, d, rng.chance(0.6) ? 'obsidian' : 'graphite', { castShadow: dist < 300 });
        lines.push({ x, z, w, d, h });
      }
    }
    // Luminous lines embedded in the monolith faces.
    for (const m of lines) {
      const mat = rng.chance(0.08) ? 'glowAmber' : rng.chance(0.25) ? 'glowViolet' : 'glowBlue';
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const face = rng.int(0, 3);
        const off = rng.range(-0.4, 0.4);
        const lh = m.h * rng.range(0.4, 0.95);
        if (face < 2) b.box(m.x + off * m.w, 0, m.z + (face ? 1 : -1) * (m.d / 2 + 0.03), 0.18, lh, 0.06, mat, { collide: false, castShadow: false });
        else b.box(m.x + (face === 2 ? 1 : -1) * (m.w / 2 + 0.03), 0, m.z + off * m.d, 0.06, lh, 0.18, mat, { collide: false, castShadow: false });
      }
      if (rng.chance(0.3)) b.box(m.x, m.h * rng.range(0.3, 0.8), m.z, m.w + 0.1, 0.12, m.d + 0.1, 'glowBlue', { collide: false, castShadow: false });
    }

    // --- The great court ---------------------------------------------------------
    b.box(-121.5, 0, 0, 3, 6, 240, 'graphite'); // west wall (holds the hidden door)
    b.box(121.5, 0, -70, 3, 6, 100, 'graphite');
    b.box(121.5, 0, 70, 3, 6, 100, 'graphite');
    b.box(-62, 0, 121.5, 120, 6, 3, 'graphite');
    b.box(62, 0, 121.5, 120, 6, 3, 'graphite');
    b.box(-120, 6, 0, 0.06, 0.06, 240, 'glowViolet', { collide: false, castShadow: false });
    // The north gate.
    doorframe(b, { x: 0, z: -121, width: 26, height: 48, frame: 7, depth: 6, mat: 'obsidian' });
    b.box(-70, 0, -121.5, 114, 6, 3, 'graphite');
    b.box(70, 0, -121.5, 114, 6, 3, 'graphite');
    // A dais and the suspended ring above the court.
    b.box(0, 0, 0, 30, 0.35, 30, 'obsidian');
    b.box(0, 0.35, 0, 0.12, 0.02, 30, 'glowBlue', { collide: false, castShadow: false });
    b.box(0, 0.35, 0, 30, 0.02, 0.12, 'glowBlue', { collide: false, castShadow: false });
    const courtRing = ring(b, { center: v3(0, 64, 0), radius: 46, thickness: 1.8, mat: 'obsidian', rotation: new THREE.Euler(Math.PI / 2 + 0.18, 0, 0) });
    const courtGlow = ring(b, { center: v3(0, 64, 0), radius: 43.6, thickness: 0.22, mat: 'glowBlue', rotation: new THREE.Euler(Math.PI / 2 + 0.18, 0, 0) });
    courtGlow.castShadow = false;
    kit.onUpdate.push((dt) => {
      courtRing.rotation.z += dt * 0.025;
      courtGlow.rotation.z += dt * 0.025;
    });
    ring(b, { center: v3(-80, 40, -70), radius: 14, thickness: 0.6, mat: 'glowViolet', spin: 0.12, spinAxis: v3(0, 1, 0) });
    ring(b, { center: v3(90, 28, 80), radius: 9, thickness: 0.5, mat: 'obsidian', spin: -0.2, spinAxis: v3(1, 0, 0) });
    sculpture(b, { position: v3(-60, 14, 50), size: 3, kind: 'octahedron', mat: 'obsidian', float: 1 });

    // The luminous pool.
    const P = { x: 70, z: 10, w: 10, d: 34 };
    b.box(P.x - P.w / 2 - 0.3, 0, P.z, 0.6, 0.25, P.d + 1.2, 'obsidian');
    b.box(P.x + P.w / 2 + 0.3, 0, P.z, 0.6, 0.25, P.d + 1.2, 'obsidian');
    b.box(P.x, 0, P.z - P.d / 2 - 0.3, P.w, 0.25, 0.6, 'obsidian');
    b.box(P.x, 0, P.z + P.d / 2 + 0.3, P.w, 0.25, 0.6, 'obsidian');
    const poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.d), pool);
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(P.x, 0.05, P.z);
    b.add(poolMesh);

    // --- The tall monolith with the unreachable room -------------------------------
    const M = { x: -160, z: -40, s: 34, h: 210, ry: 72, rh: 6 };
    const east = M.x + M.s / 2; // -143
    b.box(M.x, 0, M.z, M.s, M.ry, M.s, 'obsidian');
    b.box(M.x, M.ry + M.rh, M.z, M.s, M.h - M.ry - M.rh, M.s, 'obsidian');
    b.box(M.x - 4, M.ry, M.z, M.s - 8, M.rh, M.s, 'obsidian');
    b.box(east - 4, M.ry, M.z - 11.5, 8, M.rh, 11, 'obsidian');
    b.box(east - 4, M.ry, M.z + 11.5, 8, M.rh, 11, 'obsidian');
    b.box(east - 0.3, M.ry, M.z, 0.25, 1.05, 12, 'graphite');
    b.box(east - 4, M.ry + M.rh - 0.1, M.z, 7, 0.1, 0.25, 'glowAmber', { collide: false, castShadow: false });
    b.box(east - 4, M.ry + 0.02, M.z, 7.5, 0.02, 11.5, 'graphite', { collide: false });
    sculpture(b, { position: v3(east - 5, M.ry + 2.6, M.z + 2), size: 0.6, kind: 'nested', mat: 'obsidian', innerMat: 'glowAmber', float: 0.2 });
    for (const dz of [-5.4, 5.4]) b.box(east - 7.6, M.ry, M.z + dz, 0.1, M.rh, 0.1, 'glowAmber', { collide: false, castShadow: false });
    const roomLight = new THREE.PointLight(0xffa654, 260, 24, 1.6);
    roomLight.position.set(east - 3, M.ry + 4.5, M.z);
    b.add(roomLight);
    b.box(M.x, 0, M.z, 0.2, M.ry, M.s + 0.1, 'glowViolet', { collide: false, castShadow: false });

    // --- The anamorphic ring: fragments that align from one stone -------------------
    const V = v3(92, 1.65, -84);
    const dir = v3(0.25, 0.24, -1).normalize();
    const C = V.clone().addScaledVector(dir, 230);
    const u = new THREE.Vector3().crossVectors(dir, v3(0, 1, 0)).normalize();
    const w = new THREE.Vector3().crossVectors(u, dir).normalize();
    const R = 46;
    const N = 30;
    const segLen = ((2 * Math.PI * R) / N) * 0.82;
    const anaRng = rng.fork('anamorph');
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const P0 = C.clone().addScaledVector(u, Math.cos(th) * R).addScaledVector(w, Math.sin(th) * R);
      const s = anaRng.range(0.42, 1.7);
      const A = V.clone().add(P0.clone().sub(V).multiplyScalar(s));
      const tangent = u.clone().multiplyScalar(-Math.sin(th)).addScaledVector(w, Math.cos(th)).normalize();
      const radial = u.clone().multiplyScalar(Math.cos(th)).addScaledVector(w, Math.sin(th)).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, radial, dir.clone()));
      const sx = segLen * s;
      const sy = 2.6 * s;
      b.box(A.x, A.y - sy / 2, A.z, sx, sy, 2.6 * s, 'obsidian', { quaternion: q, collide: false, castShadow: false });
      const glowOff = A.clone().addScaledVector(radial, -1.35 * s).addScaledVector(dir, -1.35 * s);
      b.box(glowOff.x, glowOff.y - 0.15 * s, glowOff.z, sx, 0.3 * s, 0.3 * s, 'glowViolet', { quaternion: q, collide: false, castShadow: false });
    }
    b.box(V.x, 0, V.z, 1.4, 0.03, 1.4, 'glowViolet', { collide: false, castShadow: false });
    b.box(V.x, 0, V.z, 1.0, 0.04, 1.0, 'obsidian', { collide: false, castShadow: false });

    // --- A distant rotating frame that never looks the same twice ------------------
    const frame = new THREE.Group();
    frame.position.set(0, 300, -950);
    const edgeGeo = b.geometry('frame-edge', () => new THREE.BoxGeometry(1, 1, 1));
    const S = 300;
    const edges: [number, number, number, number, number, number][] = [];
    for (const a of [-1, 1]) for (const c of [-1, 1]) {
      edges.push([0, (a * S) / 2, (c * S) / 2, S, 8, 8]);
      edges.push([(a * S) / 2, 0, (c * S) / 2, 8, S, 8]);
      edges.push([(a * S) / 2, (c * S) / 2, 0, 8, 8, S]);
    }
    for (const [x, y, z, sx, sy, sz] of edges) {
      const m = new THREE.Mesh(edgeGeo, b.mat('obsidian'));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      frame.add(m);
      const g = new THREE.Mesh(edgeGeo, glowBlue);
      g.position.set(x, y, z);
      g.scale.set(sx * (sx > 10 ? 1 : 0.15), sy * (sy > 10 ? 1 : 0.15), sz * (sz > 10 ? 1 : 0.15));
      frame.add(g);
    }
    frame.rotation.set(0.6, 0.4, 0.3);
    b.add(frame);
    kit.onUpdate.push((dt) => {
      frame.rotation.y += dt * 0.02;
      frame.rotation.x += dt * 0.007;
    });

    // Freestanding slabs holding the passages to other worlds.
    b.box(-60, 0, 62, 1.6, 9, 6, 'obsidian');
    b.box(-59.2, 0, 62, 0.05, 9, 0.06, 'glowAmber', { collide: false, castShadow: false });
    b.box(30, 0, -100, 6, 8, 1.6, 'graphite');
    addDust(kit, 0x8fa8ff, 0.6, 0.05, 0.45);

    const portals: PortalDef[] = [
      {
        id: 'hidden-panel',
        position: v3(-119.98, 1.4, -40),
        rotY: Math.PI / 2,
        width: 1.6,
        height: 2.8,
        label: 'Touch the dark panel',
        discovery: 'obsidian-hidden-room',
        tint: 0xffa654,
        target: { kind: 'local', position: v3(east - 7.4, M.ry + 1.4, M.z), rotY: -Math.PI / 2 },
      },
      {
        id: 'room-return',
        position: v3(east - 7.95, M.ry + 1.4, M.z - 3),
        rotY: Math.PI / 2,
        width: 1.6,
        height: 2.8,
        label: 'Return to the court',
        tint: 0xffa654,
        target: { kind: 'local', position: v3(-119.4, 1.4, -42), rotY: -Math.PI / 2 },
      },
      {
        id: 'to-cathedral',
        position: v3(-59.15, 1.5, 62),
        rotY: Math.PI / 2,
        width: 1.1,
        height: 3,
        label: 'Return to the drowned nave',
        tint: 0xffe3b8,
        target: { kind: 'world', worldId: 'sunken-cathedral', arrival: 'from-obsidian' },
      },
      {
        id: 'to-house',
        position: v3(30, 1.3, -99.15),
        rotY: 0,
        width: 1.2,
        height: 2.5,
        label: 'Open the door left ajar',
        tint: 0xf2c9b8,
        target: { kind: 'world', worldId: 'impossible-house', arrival: 'from-obsidian' },
      },
    ];

    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: v3(0, 0, 144), yaw: 0 },
      arrivals: {
        'from-cathedral': { position: v3(-57.5, 0, 62), yaw: -Math.PI / 2 },
        'from-house': { position: v3(30, 0, -97), yaw: Math.PI },
      },
      killY: -30,
      soundscape: 'obsidian',
      portals,
      emitters: [
        { position: v3(P.x, 0.5, P.z), kind: 'hum', radius: 30, pitch: 82.4 },
        { position: v3(0, 64, 0), kind: 'hum', radius: 110, pitch: 41.2 },
      ],
      discoveries: [
        {
          id: 'obsidian-pool',
          position: v3(P.x, 0, P.z),
          radius: 4.5,
          mode: 'proximity',
          onDiscover: () => {
            for (const g of glows) {
              g.uniforms.uWaveOrigin.value.set(P.x, 0, P.z);
              g.uniforms.uWaveStart.value = now;
              g.uniforms.uBoost.value = 0.6;
            }
            pool.uniforms.uWake.value = 1;
            ctx.services.sound('reveal');
          },
        },
        {
          id: 'obsidian-anamorph',
          position: V,
          radius: 1.3,
          mode: 'view',
          lookAt: C,
          onDiscover: () => {
            glowViolet.uniforms.uIntensity.value = 7;
            ctx.services.sound('resonance');
          },
        },
      ],
      cinematic: [
        { points: [v3(0, 1.8, 140), v3(0, 2.2, 100), v3(0, 6, 60)], look: [v3(0, 3, 100), v3(0, 14, 40), v3(0, 40, 0)], duration: 20 },
        { points: [v3(-90, 1.2, 90), v3(-30, 1.0, 20), v3(40, 1.4, -60)], look: [v3(0, 10, 0), v3(20, 20, -40), v3(60, 30, -200)], duration: 24 },
        { points: [v3(60, 4, 60), v3(50, 40, 30), v3(30, 80, 10)], look: [v3(0, 64, 0), v3(0, 64, 0), v3(0, 80, -300)], duration: 22 },
        { points: [v3(80, 2, -60), v3(88, 1.8, -76), V.clone()], look: [C.clone().add(v3(-60, -10, 0)), C.clone(), C.clone()], duration: 18 },
        { points: [v3(-110, 30, 40), v3(-130, 70, -10), v3(-138, 74, -36)], look: [v3(-150, 74, -40), v3(-150, 74, -40), v3(0, 40, 0)], duration: 20 },
      ],
    });
  },
};
