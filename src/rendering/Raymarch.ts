import * as THREE from 'three';

export interface RaymarchOptions {
  /**
   * GLSL defining:
   *   float sceneSigma(vec3 ro)                       — viewer scale (1 for fixed-scale scenes)
   *   float sceneMap(vec3 p, float sigma, float t, out float id)
   *   vec3  sceneShade(vec3 p, vec3 n, vec3 rd, float t, float id, float ao, float shadow, float sigma)
   */
  glsl: string;
  uniforms?: Record<string, THREE.IUniform>;
  steps: number;
  /** Max ray length in units of sigma. */
  maxDistance: number;
  fogColor: THREE.ColorRepresentation;
  /** FogExp2-style density in units of sigma. */
  fogDensity: number;
  sunDirection: THREE.Vector3;
  /** Shadow-march steps (0 disables). */
  shadowSteps: number;
}

/**
 * A full-screen ray-marched layer. It writes gl_FragDepth, so ordinary
 * meshes (portals, sculptures, particles) occlude and are occluded by the
 * fractal correctly, and it goes through the same post-processing chain.
 */
export function createRaymarchLayer(o: RaymarchOptions): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const uniforms: Record<string, THREE.IUniform> = {
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uViewProj: { value: new THREE.Matrix4() },
    uFogColor: { value: new THREE.Color(o.fogColor) },
    uFogDensity: { value: o.fogDensity },
    uSun: { value: o.sunDirection.clone().normalize() },
    uTime: { value: 0 },
    ...(o.uniforms ?? {}),
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: { STEPS: o.steps, MAX_DIST: o.maxDistance.toFixed(2), SHADOW_STEPS: o.shadowSteps },
    vertexShader: /* glsl */ `
      varying vec2 vNdc;
      void main() {
        vNdc = position.xy;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform mat4 uInvProj;
      uniform mat4 uCamWorld;
      uniform mat4 uViewProj;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uSun;
      uniform float uTime;
      varying vec2 vNdc;
      ${o.glsl}

      vec3 calcNormal(vec3 p, float sigma, float t) {
        float e = max(0.0005 * t, 0.0004 * sigma);
        float id;
        vec2 k = vec2(1.0, -1.0);
        return normalize(
          k.xyy * sceneMap(p + k.xyy * e, sigma, t, id) +
          k.yyx * sceneMap(p + k.yyx * e, sigma, t, id) +
          k.yxy * sceneMap(p + k.yxy * e, sigma, t, id) +
          k.xxx * sceneMap(p + k.xxx * e, sigma, t, id));
      }

      float calcAO(vec3 p, vec3 n, float sigma, float t) {
        float occ = 0.0;
        float w = 1.0;
        float id;
        for (int i = 1; i <= 5; i++) {
          float h = 0.06 * sigma * float(i * i);
          occ += (h - sceneMap(p + n * h, sigma, t, id)) * w;
          w *= 0.6;
        }
        return clamp(1.0 - occ / (0.6 * sigma), 0.0, 1.0);
      }

      float calcShadow(vec3 p, vec3 l, float sigma, float t) {
      #if SHADOW_STEPS > 0
        float res = 1.0;
        float s = 0.05 * sigma;
        float id;
        for (int i = 0; i < SHADOW_STEPS; i++) {
          float h = sceneMap(p + l * s, sigma, t, id);
          res = min(res, 8.0 * h / s);
          s += clamp(h, 0.05 * sigma, 3.0 * sigma);
          if (res < 0.01 || s > 60.0 * sigma) break;
        }
        return clamp(res, 0.0, 1.0);
      #else
        return 1.0;
      #endif
      }

      void main() {
        vec4 vp = uInvProj * vec4(vNdc, 1.0, 1.0);
        vp /= vp.w;
        vec3 ro = cameraPosition;
        vec3 rd = normalize(mat3(uCamWorld) * vp.xyz);
        float sigma = sceneSigma(ro);
        float t = 0.0;
        float tmax = MAX_DIST * sigma;
        float id = 0.0;
        bool hit = false;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = ro + rd * t;
          float d = sceneMap(p, sigma, t, id);
          if (d < 0.0008 * t + 0.0005 * sigma) { hit = true; break; }
          t += d * 0.92;
          if (t > tmax) break;
        }
        if (!hit) discard;
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p, sigma, t);
        float ao = calcAO(p, n, sigma, t);
        float sh = calcShadow(p + n * 0.01 * sigma, uSun, sigma, t);
        vec3 col = sceneShade(p, n, rd, t, id, ao, sh, sigma);
        float f = 1.0 - exp(-pow(uFogDensity * t / sigma, 2.0));
        col = mix(col, uFogColor, f);
        // One NaN pixel would be smeared over the whole screen by bloom; never emit one.
        if (any(isnan(col)) || any(isinf(col))) col = uFogColor;
        gl_FragColor = vec4(min(col, vec3(64.0)), 1.0);
        vec4 clip = uViewProj * vec4(p, 1.0);
        gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
      }`,
    depthTest: true,
    depthWrite: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -500;
  mesh.name = 'raymarch';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // Per-camera matrices: works for the main view and for portal virtual cameras.
  mesh.onBeforeRender = (_r, _s, camera) => {
    uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    uniforms.uCamWorld.value.copy(camera.matrixWorld);
    uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  };
  return mesh;
}
