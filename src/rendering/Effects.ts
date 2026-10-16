import * as THREE from 'three';
import { NOISE_GLSL } from './shaders/noise.glsl';

/** Fake volumetric sunbeam: additive soft cylinder aligned with the light. */
export function createLightShaft(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radiusTop: number,
  radiusBottom: number,
  color: THREE.ColorRepresentation,
  intensity = 0.35,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 24, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      varying float vH;
      void main() {
        vH = uv.y;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vW;
      varying float vH;
      void main() {
        vec3 v = normalize(cameraPosition - vW);
        float edge = pow(abs(dot(normalize(vN), v)), 2.0);
        float vert = smoothstep(0.0, 0.35, vH) * smoothstep(1.0, 0.75, vH);
        float d = length(cameraPosition - vW);
        float near = smoothstep(1.0, 6.0, d);
        float shimmer = 0.85 + 0.15 * sin(vW.y * 1.7 + uTime * 0.6 + vW.x * 0.4);
        gl_FragColor = vec4(uColor * edge * vert * near * shimmer * uIntensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.renderOrder = 10;
  mesh.name = 'lightshaft';
  return mesh;
}

/** Infinite field of drifting motes wrapped around the camera. */
export function createDust(count: number, color: THREE.ColorRepresentation, size = 0.06, extent = 40, opacity = 0.6): THREE.Points {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * extent;
    pos[i * 3 + 1] = (rnd() - 0.5) * extent * 0.5;
    pos[i * 3 + 2] = (rnd() - 0.5) * extent;
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uExtent: { value: new THREE.Vector3(extent, extent * 0.5, extent) },
      uOpacity: { value: opacity },
      uScale: { value: window.innerHeight / 2 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uSize, uScale;
      uniform vec3 uExtent;
      varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.07 + aSeed * 40.0) * 2.0, uTime * (0.05 + aSeed * 0.12), cos(uTime * 0.05 + aSeed * 23.0) * 2.0);
        vec3 c = cameraPosition;
        p = mod(p - c + uExtent * 0.5, uExtent) - uExtent * 0.5 + c;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = smoothstep(0.5, 3.0, d) * (1.0 - smoothstep(uExtent.x * 0.25, uExtent.x * 0.5, d)) * (0.4 + 0.6 * fract(aSeed * 7.31));
        gl_PointSize = uSize * uScale / max(d, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r) * vA * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'dust';
  return points;
}

export interface CloudSeaOptions {
  y: number;
  size?: number;
  lit: THREE.ColorRepresentation;
  shadow: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  sunDirection: THREE.Vector3;
  cover?: number;
  opacity?: number;
  scale?: number;
  wind?: number;
  octaves: number;
  fadeEnd?: number;
}

/** A sea of clouds: a huge plane with layered fbm, faked sun scattering and horizon fade. */
export function createCloudLayer(o: CloudSeaOptions): THREE.Mesh {
  const size = o.size ?? 9000;
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLit: { value: new THREE.Color(o.lit) },
      uShadow: { value: new THREE.Color(o.shadow) },
      uHorizon: { value: new THREE.Color(o.horizon) },
      uSunDir: { value: o.sunDirection.clone().normalize() },
      uCover: { value: o.cover ?? 0.45 },
      uOpacity: { value: o.opacity ?? 1 },
      uScale: { value: o.scale ?? 0.004 },
      uWind: { value: o.wind ?? 1 },
      uFadeEnd: { value: o.fadeEnd ?? 3500 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      #define LW_OCTAVES ${o.octaves}
      ${NOISE_GLSL}
      uniform float uTime, uCover, uOpacity, uScale, uWind, uFadeEnd;
      uniform vec3 uLit, uShadow, uHorizon, uSunDir;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz * uScale;
        vec2 w = vec2(uTime * 0.012, uTime * 0.004) * uWind;
        float n = lw_fbm(p + w);
        float n2 = lw_fbm(p * 2.7 - w * 1.6 + n);
        float dens = n * 0.65 + n2 * 0.35;
        float alpha = smoothstep(uCover - 0.18, uCover + 0.22, dens);
        vec2 sp = p + normalize(uSunDir.xz + 1e-4) * 0.06;
        float ns = lw_fbm(sp + w) * 0.65 + n2 * 0.35;
        float lit = clamp(0.55 + (dens - ns) * 5.0 + (dens - 0.5) * 0.6, 0.0, 1.0);
        vec3 col = mix(uShadow, uLit, lit);
        float dist = length(vW.xz - cameraPosition.xz);
        float fade = smoothstep(uFadeEnd * 0.15, uFadeEnd, dist);
        col = mix(col, uHorizon, fade);
        alpha = mix(alpha, 1.0, fade * step(0.99, uOpacity)) * uOpacity;
        alpha *= 1.0 - smoothstep(uFadeEnd * 0.9, uFadeEnd * 1.2, dist) * (1.0 - step(0.99, uOpacity));
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = o.y;
  mesh.frustumCulled = false;
  mesh.name = 'clouds';
  return mesh;
}

/** Update every animated shader uniform under `root` named uTime. */
export function tickShaderTime(root: THREE.Object3D, t: number): void {
  root.traverse((obj) => {
    const mat = (obj as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (mat && (mat as THREE.ShaderMaterial).isShaderMaterial && mat.uniforms?.uTime) mat.uniforms.uTime.value = t;
  });
}
