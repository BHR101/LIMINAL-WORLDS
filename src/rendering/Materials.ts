import * as THREE from 'three';
import { RNG } from '../core/rng';

/**
 * Procedural material library.
 *
 * Architectural surfaces use MeshStandardMaterial patched with world-space
 * triplanar sampling of one shared, tileable noise texture. Because sampling
 * happens in world space, a unit box scaled to 40 m tall still reads as
 * consistent poured concrete — which is what lets the architecture generators
 * share a handful of instanced geometries.
 */

let sharedNoise: THREE.DataTexture | null = null;

function makeLattice(rng: RNG, size: number): Float32Array {
  const t = new Float32Array(size * size);
  for (let i = 0; i < t.length; i++) t[i] = rng.next();
  return t;
}

function periodicNoise(lat: Float32Array, f: number, x: number, y: number): number {
  const fx = x * f;
  const fy = y * f;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const at = (i: number, j: number) => lat[(((j % f) + f) % f) * f + (((i % f) + f) % f)];
  const a = at(ix, iy);
  const b = at(ix + 1, iy);
  const c = at(ix, iy + 1);
  const d = at(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Tileable RGBA noise: R broad blotches, G fine grain, B pores, A vertical streaks. */
export function getNoiseTexture(): THREE.DataTexture {
  if (sharedNoise) return sharedNoise;
  const size = 256;
  const rng = new RNG(1337);
  const lats = [4, 8, 16, 32, 64].map((f) => ({ f, lat: makeLattice(rng, f) }));
  const streakLat = makeLattice(rng, 64);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let broad = 0;
      let amp = 0.5;
      for (let o = 0; o < 4; o++) {
        broad += amp * periodicNoise(lats[o].lat, lats[o].f, u, v);
        amp *= 0.5;
      }
      broad /= 0.9375;
      const fine = periodicNoise(lats[3].lat, 32, u, v) * 0.5 + periodicNoise(lats[4].lat, 64, u, v) * 0.5;
      const pores = periodicNoise(lats[4].lat, 64, u + 0.37, v + 0.11);
      // Streaks: high frequency across, low frequency along v.
      const streak = periodicNoise(streakLat, 64, u, v * 0.0625) * 0.7 + periodicNoise(lats[1].lat, 8, u, v) * 0.3;
      const i = (y * size + x) * 4;
      data[i] = Math.round(broad * 255);
      data[i + 1] = Math.round(fine * 255);
      data[i + 2] = Math.round(pores * 255);
      data[i + 3] = Math.round(streak * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  sharedNoise = tex;
  return tex;
}

export interface ArchMaterialOptions {
  color: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  /** Texture frequency in cycles per metre. */
  scale?: number;
  /** Strength of tonal variation, 0..1. */
  variation?: number;
  /** Formwork panel height in metres (0 disables joints and tie holes). */
  panel?: number;
  /** Vertical weathering streaks on walls, 0..1. */
  streaks?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
}

export function createArchMaterial(o: ArchMaterialOptions): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.85,
    metalness: o.metalness ?? 0,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    envMapIntensity: o.envMapIntensity ?? 1,
    side: o.side ?? THREE.FrontSide,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  const uniforms = {
    uNoise: { value: getNoiseTexture() },
    uScale: { value: o.scale ?? 0.18 },
    uVariation: { value: o.variation ?? 0.6 },
    uPanel: { value: o.panel ?? 0 },
    uStreak: { value: o.streaks ?? 0.25 },
  };
  mat.userData.archUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vLwPos;
varying vec3 vLwNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
{
  vec4 lwp = vec4(transformed, 1.0);
  vec3 lwn = objectNormal;
#ifdef USE_INSTANCING
  lwp = instanceMatrix * lwp;
  lwn = mat3(instanceMatrix) * lwn;
#endif
  vLwPos = (modelMatrix * lwp).xyz;
  vLwNormal = normalize(mat3(modelMatrix) * lwn);
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uNoise;
uniform float uScale;
uniform float uVariation;
uniform float uPanel;
uniform float uStreak;
varying vec3 vLwPos;
varying vec3 vLwNormal;
vec4 lwTri(float s) {
  vec3 bw = pow(abs(vLwNormal), vec3(6.0));
  bw /= dot(bw, vec3(1.0));
  return texture2D(uNoise, vLwPos.zy * s) * bw.x
       + texture2D(uNoise, vLwPos.xz * s) * bw.y
       + texture2D(uNoise, vLwPos.xy * s) * bw.z;
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec4 lwA = lwTri(uScale);
vec4 lwB = lwTri(uScale * 0.17);
float lwTone = (lwA.g - 0.5) * 0.35 + (lwB.r - 0.5) * 0.8;
float lwPores = smoothstep(0.8, 0.92, lwA.b) * 0.3;
float lwStreak = (1.0 - abs(vLwNormal.y)) * (lwA.a - 0.45) * uStreak;
float lwJoint = 0.0;
float lwHole = 0.0;
if (uPanel > 0.0) {
  vec3 an = abs(vLwNormal);
  vec2 pc = an.x > 0.5 ? vLwPos.zy : (an.y > 0.5 ? vLwPos.xz : vLwPos.xy);
  vec2 cellSize = vec2(uPanel * 2.0, uPanel);
  vec2 cell = pc / cellSize;
  vec2 f = abs(fract(cell) - 0.5) * cellSize;
  float edge = min(cellSize.x * 0.5 - f.x, cellSize.y * 0.5 - f.y);
  float fw = length(fwidth(pc));
  float vis = 1.0 - smoothstep(0.015, 0.08, fw);
  lwJoint = (1.0 - smoothstep(0.006, 0.02 + fw, edge)) * vis;
  vec2 q = (fract(cell * vec2(2.0, 1.0)) - 0.5) * uPanel;
  lwHole = (1.0 - smoothstep(0.018, 0.03 + fw, length(q))) * vis;
}
float lwShade = 1.0 + uVariation * (lwTone - lwPores) - lwStreak - lwJoint * 0.3 - lwHole * 0.45;
diffuseColor.rgb *= clamp(lwShade, 0.15, 1.7);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (lwA.g - 0.5) * 0.3 * uVariation + lwJoint * 0.15, 0.03, 1.0);`,
      );
  };
  mat.customProgramCacheKey = () => 'liminal-arch-v1';
  return mat;
}

/** Self-lit material with a slow travelling pulse — for luminous lines and artifacts. */
export function createGlowMaterial(color: THREE.ColorRepresentation, intensity = 3, pulse = 0.35, speed = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity },
        uPulse: { value: pulse },
        uSpeed: { value: speed },
        uTime: { value: 0 },
        uWaveOrigin: { value: new THREE.Vector3() },
        uWaveStart: { value: -1 },
        uBoost: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 wp = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPulse;
      uniform float uSpeed;
      uniform float uTime;
      uniform vec3 uWaveOrigin;
      uniform float uWaveStart;
      uniform float uBoost;
      varying vec3 vW;
      void main() {
        float wave = 0.5 + 0.5 * sin(vW.y * 0.35 + vW.x * 0.05 + vW.z * 0.05 - uTime * uSpeed);
        float k = mix(1.0, 0.35 + wave * 1.1, uPulse);
        if (uWaveStart >= 0.0) {
          // An expanding ring of light that leaves everything it passes brighter.
          float r = (uTime - uWaveStart) * 60.0;
          float d = length(vW.xz - uWaveOrigin.xz);
          float front = exp(-pow((d - r) / 12.0, 2.0)) * 2.5;
          k *= 1.0 + front + step(d, r) * uBoost;
        }
        gl_FragColor = vec4(uColor * uIntensity * k, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

/** Per-world palette of reusable materials. */
export interface MaterialSet {
  [key: string]: THREE.Material;
}

export function disposeMaterials(set: MaterialSet): void {
  for (const m of Object.values(set)) m.dispose();
}
