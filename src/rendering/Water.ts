import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export interface WaterOptions {
  width: number;
  depth: number;
  color: THREE.ColorRepresentation;
  /** Base opacity looking straight down (shallow water shows the floor). */
  opacity?: number;
  reflectivity?: number;
  distortion?: number;
  waveScale?: number;
  /** Fraction of the screen used for the reflection render target. */
  resolutionScale: number;
  tint?: THREE.ColorRepresentation;
}

/**
 * Planar-reflection water: one extra half-resolution scene render with an
 * oblique clip plane (three's Reflector), distorted by an analytic ripple
 * normal. Restrained by design — no full-scene simulation.
 */
export function createWater(o: WaterOptions): Reflector {
  const w = Math.max(128, Math.round(window.innerWidth * o.resolutionScale * Math.min(window.devicePixelRatio, 1.5)));
  const h = Math.max(128, Math.round(window.innerHeight * o.resolutionScale * Math.min(window.devicePixelRatio, 1.5)));
  const shader = {
    name: 'LiminalWater',
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(o.color) },
        uTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
        uAlpha: { value: o.opacity ?? 0.85 },
        uReflect: { value: o.reflectivity ?? 0.85 },
        uDistort: { value: o.distortion ?? 0.03 },
        uWaveScale: { value: o.waveScale ?? 1 },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime, uAlpha, uReflect, uDistort, uWaveScale;
      uniform vec3 uDeep, uTint;
      varying vec4 vUv;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>
      vec2 waveGrad(vec2 p, float t) {
        vec2 g = vec2(0.0);
        vec2 d1 = normalize(vec2(1.0, 0.3));
        vec2 d2 = normalize(vec2(-0.4, 1.0));
        vec2 d3 = normalize(vec2(0.7, -0.8));
        vec2 d4 = normalize(vec2(-1.0, -0.2));
        g += d1 * cos(dot(p, d1) * 0.9 + t * 0.9) * 0.9 * 0.022;
        g += d2 * cos(dot(p, d2) * 1.7 + t * 1.3) * 1.7 * 0.012;
        g += d3 * cos(dot(p, d3) * 3.9 + t * 2.1) * 3.9 * 0.006;
        g += d4 * cos(dot(p, d4) * 7.3 + t * 2.9) * 7.3 * 0.0025;
        return g;
      }
      void main() {
        vec2 g = waveGrad(vWorld.xz * uWaveScale, uTime);
        float dist = length(cameraPosition - vWorld);
        g *= 1.0 - smoothstep(30.0, 160.0, dist) * 0.8;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec4 uv = vUv;
        uv.xy += n.xz * uDistort * uv.w;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb * uTint;
        float r = clamp((0.45 + 0.55 * fres) * uReflect, 0.0, 1.0);
        vec3 col = mix(uDeep, refl, r);
        float alpha = clamp(mix(uAlpha, 1.0, fres + r * 0.5), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  };
  const water = new Reflector(new THREE.PlaneGeometry(o.width, o.depth), {
    textureWidth: w,
    textureHeight: h,
    clipBias: 0.002,
    shader,
    multisample: 0,
  });
  const mat = water.material as THREE.ShaderMaterial;
  mat.fog = true;
  mat.transparent = (o.opacity ?? 0.85) < 1;
  mat.depthWrite = !mat.transparent;
  water.rotation.x = -Math.PI / 2;
  water.name = 'water';
  water.receiveShadow = false;
  return water;
}

export function waterUniforms(water: Reflector): Record<string, THREE.IUniform> {
  return (water.material as THREE.ShaderMaterial).uniforms;
}
