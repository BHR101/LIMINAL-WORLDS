import * as THREE from 'three';
import { NOISE_GLSL } from './shaders/noise.glsl';

export interface SkyOptions {
  top: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  bottom: THREE.ColorRepresentation;
  sunDirection: THREE.Vector3;
  sunColor: THREE.ColorRepresentation;
  sunSize?: number;
  sunGlow?: number;
  clouds?: number;
  cloudColor?: THREE.ColorRepresentation;
  cloudShadow?: THREE.ColorRepresentation;
  stars?: number;
  /** Raises or lowers the horizon gradient (0 = geometric horizon). */
  horizonOffset?: number;
}

/** Gradient sky dome with sun disc, glow, procedural cirrus and optional stars. */
export function createSky(o: SkyOptions): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(o.top) },
      uHorizon: { value: new THREE.Color(o.horizon) },
      uBottom: { value: new THREE.Color(o.bottom) },
      uSunDir: { value: o.sunDirection.clone().normalize() },
      uSunColor: { value: new THREE.Color(o.sunColor) },
      uSunSize: { value: o.sunSize ?? 0.0006 },
      uSunGlow: { value: o.sunGlow ?? 1 },
      uCloud: { value: o.clouds ?? 0 },
      uCloudColor: { value: new THREE.Color(o.cloudColor ?? 0xffffff) },
      uCloudShadow: { value: new THREE.Color(o.cloudShadow ?? 0x888888) },
      uStars: { value: o.stars ?? 0 },
      uHorizonOffset: { value: o.horizonOffset ?? 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      #define LW_OCTAVES 4
      ${NOISE_GLSL}
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor, uCloudShadow;
      uniform float uSunSize, uSunGlow, uCloud, uStars, uTime, uHorizonOffset;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y - uHorizonOffset;
        vec3 col = h > 0.0
          ? mix(uHorizon, uTop, pow(clamp(h * 1.15, 0.0, 1.0), 0.5))
          : mix(uHorizon, uBottom, pow(clamp(-h * 2.5, 0.0, 1.0), 0.6));
        vec3 sd3 = normalize(uSunDir);
        float sd = max(dot(d, sd3), 0.0);
        col += uSunColor * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.5) * uSunGlow;
        col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.5, sd) * 8.0;
        if (uCloud > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (d.y + 0.08);
          float n = lw_fbm(uv * 1.4 + vec2(uTime * 0.004, uTime * 0.002));
          float n2 = lw_fbm(uv * 3.1 - vec2(uTime * 0.006, 0.0));
          float c = smoothstep(0.42, 0.85, n * 0.75 + n2 * 0.25) * uCloud * smoothstep(0.0, 0.25, h);
          vec3 cc = mix(uCloudShadow, uCloudColor, clamp(0.35 + pow(sd, 3.0) * 0.9 + (n2 - 0.5), 0.0, 1.0));
          col = mix(col, cc, c);
        }
        if (uStars > 0.0 && h > 0.0) {
          vec2 sp = d.xz / (d.y + 1.0) * 380.0;
          float s = lw_hash(floor(sp));
          float tw = 0.6 + 0.4 * sin(uTime * 1.3 + s * 60.0);
          col += vec3(smoothstep(0.996, 1.0, s)) * uStars * tw * smoothstep(0.0, 0.3, h);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  return mesh;
}
