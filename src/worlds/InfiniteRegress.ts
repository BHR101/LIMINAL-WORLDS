import * as THREE from 'three';
import { RNG } from '../core/rng';
import { MENGER_GLSL, mengerSDF } from '../rendering/Fractals';
import { createRaymarchLayer } from '../rendering/Raymarch';
import { beginWorld, finishWorld, v3 } from './WorldKit';
import type { WorldDefinition } from './types';

/** Distance from the vanishing point at which the viewer is "full size". */
const R0 = 30;
const SIZE = 0.6; // body scale relative to the local structure

const sigmaOf = (p: THREE.Vector3) => Math.max(p.length() / R0, 1e-6);
const field = (p: THREE.Vector3) => mengerSDF(p.x, p.y, p.z, sigmaOf(p));

/** Find a straight line into the vanishing point that stays clear of stone at every scale. */
function findCorridor(seed: number): THREE.Vector3 {
  const rng = new RNG(seed);
  let best = v3(1, 0.62, 0.81).normalize();
  let bestClear = -Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i < 600; i++) {
    const u = v3(rng.range(0.2, 1), rng.range(-0.6, 0.9), rng.range(0.2, 1)).normalize();
    let clear = Infinity;
    for (let j = 0; j <= 48; j++) {
      const r = R0 * Math.pow(3, -j / 48);
      p.copy(u).multiplyScalar(r);
      clear = Math.min(clear, mengerSDF(p.x, p.y, p.z, r / R0) / (r / R0));
      if (clear < bestClear) break;
    }
    if (clear > bestClear) {
      bestClear = clear;
      best = u;
    }
  }
  return best;
}

export const InfiniteRegress: WorldDefinition = {
  id: 'infinite-regress',
  numeral: 'I',
  name: 'The Infinite Regress',
  tagline: 'Fly toward the vanishing point. You will never arrive.',
  description:
    'A Menger lattice carved at every power of three. Fly inward and you shrink; the halls become towers, the towers become dust, and the dust becomes halls again. It does not end in either direction.',
  build(ctx) {
    const sunDir = v3(0.42, 0.78, 0.46).normalize();
    const fogColor = 0x1c1f26;
    const kit = beginWorld(
      ctx,
      {},
      {
        sky: { top: 0x0b0d12, horizon: fogColor, bottom: 0x15130f, sunDirection: sunDir, sunColor: 0xffd9a8, sunSize: 0.0004, sunGlow: 0.3, clouds: 0, stars: 0.4 },
        fogDensity: 0.0001,
        sunIntensity: 1,
        hemiSky: 0xffffff,
        hemiGround: 0x888888,
        hemiIntensity: 0.3,
        exposure: 1.1,
        bloom: 0.45,
        vignette: 0.45,
      },
    );
    kit.atm.sun.castShadow = false;
    const q = ctx.quality;
    const layer = createRaymarchLayer({
      steps: q.preset === 'performance' ? 72 : q.preset === 'balanced' ? 104 : 150,
      maxDistance: 160,
      fogColor,
      fogDensity: 0.0085,
      sunDirection: sunDir,
      shadowSteps: q.preset === 'performance' ? 0 : q.preset === 'balanced' ? 18 : 32,
      uniforms: {
        uR0: { value: R0 },
        uSunColor: { value: new THREE.Color(0xffd6a0) },
        uSkyLight: { value: new THREE.Color(0x46536a) },
        uBounce: { value: new THREE.Color(0x8a5a3a) },
        uGlow: { value: new THREE.Color(0xffb46a) },
      },
      glsl: /* glsl */ `
        uniform float uR0;
        uniform vec3 uSunColor, uSkyLight, uBounce, uGlow;
        ${MENGER_GLSL}
        float sceneSigma(vec3 ro) { return max(length(ro) / uR0, 1e-6); }
        float sceneMap(vec3 p, float sigma, float t, out float id) { return mengerMap(p, sigma, t, id); }
        vec3 sceneShade(vec3 p, vec3 n, vec3 rd, float t, float id, float ao, float sh, float sigma) {
          float b = mod(id + 30.0, 3.0);
          vec3 base = b < 0.5 ? vec3(0.82, 0.78, 0.72) : (b < 1.5 ? vec3(0.42, 0.43, 0.46) : vec3(0.70, 0.55, 0.42));
          float dif = max(dot(n, uSun), 0.0) * sh;
          float sky = 0.5 + 0.5 * n.y;
          float bounce = max(dot(n, -uSun), 0.0);
          vec3 col = base * (uSunColor * dif * 2.0 + uSkyLight * sky * 0.55 * ao + uBounce * bounce * 0.35 * ao);
          // The deepest recesses glow faintly, as if lit from somewhere further in.
          col *= 0.25 + 0.75 * ao;
          col += uGlow * pow(1.0 - ao, 2.5) * 0.9;
          return col;
        }`,
    });
    kit.b.add(layer);

    const corridor = findCorridor(ctx.seed || 9);
    const start = corridor.clone().multiplyScalar(R0 * 0.85);
    const aim = corridor.clone().negate();
    const yaw = Math.atan2(-aim.x, -aim.z);
    const pitch = Math.asin(aim.y);

    // Shepard tone phase follows log-scale depth: inward forever = falling forever.
    let depth = 0; // renormalisations, inward positive
    const shepard = (p: THREE.Vector3) => ctx.services.shepard(depth + Math.log(R0 / p.length()) / Math.log(3));

    // Title / cinematic: an endless drift into the vanishing point.
    let driverT = 0;
    const camPos = new THREE.Vector3();
    const driver = (dt: number, camera: THREE.PerspectiveCamera) => {
      driverT += dt;
      const period = 11; // seconds per factor of three
      const phase = (driverT / period) % 1;
      const r = R0 * Math.pow(3, -phase);
      camPos.copy(corridor).multiplyScalar(r);
      // A slow, scale-relative sway keeps the view alive without touching stone.
      const side = new THREE.Vector3().crossVectors(corridor, v3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(side, corridor).normalize();
      const sw = (r / R0) * 0.08;
      camPos.addScaledVector(side, Math.sin(driverT * 0.31) * sw).addScaledVector(up, Math.cos(driverT * 0.23) * sw);
      camera.position.copy(camPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.rotateZ(driverT * 0.035);
      ctx.services.shepard(driverT / period);
    };

    let inward = 0;
    let outward = 0;
    kit.onDispose.push(() => ctx.services.shepard(null));

    return finishWorld(kit, {
      id: this.id,
      name: this.name,
      subtitle: this.tagline,
      spawn: { position: start, yaw, pitch },
      killY: -1e9,
      soundscape: 'regress',
      renderScale: q.preset === 'cinematic' ? 0.85 : 0.7,
      cinematic: [],
      cameraDriver: driver,
      flight: {
        sdf: field,
        afterUpdate: (player) => {
          const r = player.position.length();
          if (r < R0 / 3) {
            player.rescale(3);
            depth++;
            inward++;
            outward = Math.max(0, outward - 1);
            if (inward >= 3) ctx.services.discover('regress-inward');
          } else if (r > R0) {
            player.rescale(1 / 3);
            depth--;
            outward++;
            inward = Math.max(0, inward - 1);
            if (outward >= 3) ctx.services.discover('regress-outward');
          }
          player.scale = sigmaOf(player.position) * SIZE;
          shepard(player.position);
        },
      },
    });
  },
};
