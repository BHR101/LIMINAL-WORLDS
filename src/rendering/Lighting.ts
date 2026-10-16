import * as THREE from 'three';
import { createSky, type SkyOptions } from './Sky';
import type { QualityProfile } from './Quality';

export interface AtmosphereConfig {
  sky: SkyOptions;
  fogColor?: THREE.ColorRepresentation;
  fogDensity: number;
  sunIntensity: number;
  hemiSky: THREE.ColorRepresentation;
  hemiGround: THREE.ColorRepresentation;
  hemiIntensity: number;
  environmentIntensity?: number;
  exposure: number;
  bloom?: number;
  /** Half-extent of the shadow frustum that follows the player. */
  shadowRange?: number;
  /** Grade: 1 = neutral saturation. */
  saturation?: number;
  vignette?: number;
}

export interface Atmosphere {
  config: AtmosphereConfig;
  sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.FogExp2;
  sunDirection: THREE.Vector3;
  baseSunColor: THREE.Color;
  baseSunIntensity: number;
  baseHemiIntensity: number;
  /** Re-centre the shadow frustum near the viewer. */
  follow(center: THREE.Vector3): void;
  dispose(): void;
}

/**
 * Builds the sky, fog, sun and image-based lighting for a world. The sky is
 * also baked once into a PMREM environment map, which gives glass, water and
 * polished stone believable reflections at no per-frame cost.
 */
export function createAtmosphere(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  quality: QualityProfile,
  config: AtmosphereConfig,
): Atmosphere {
  const sky = createSky(config.sky);
  scene.add(sky);

  const fogColor = new THREE.Color(config.fogColor ?? config.sky.horizon);
  const fog = new THREE.FogExp2(fogColor, config.fogDensity);
  scene.fog = fog;
  scene.background = null;

  const sunDirection = config.sky.sunDirection.clone().normalize();
  const sun = new THREE.DirectionalLight(config.sky.sunColor, config.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  const range = config.shadowRange ?? 70;
  const cam = sun.shadow.camera;
  cam.left = -range;
  cam.right = range;
  cam.top = range;
  cam.bottom = -range;
  cam.near = 1;
  cam.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = quality.softShadows ? 3 : 1;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(config.hemiSky, config.hemiGround, config.hemiIntensity);
  scene.add(hemi);

  // Bake the sky into an environment map (one-time cost).
  const envScene = new THREE.Scene();
  const envSky = createSky({ ...config.sky, sunSize: 0.004, sunGlow: (config.sky.sunGlow ?? 1) * 0.6 });
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  envSky.geometry.dispose();
  envSky.material.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = config.environmentIntensity ?? 0.6;

  const texel = (range * 2) / quality.shadowMapSize;
  const tmp = new THREE.Vector3();

  return {
    config,
    sky,
    sun,
    hemi,
    fog,
    sunDirection,
    baseSunColor: sun.color.clone(),
    baseSunIntensity: config.sunIntensity,
    baseHemiIntensity: config.hemiIntensity,
    follow(center) {
      // Snap to shadow texels along the light's plane to avoid shimmering edges.
      tmp.copy(center);
      tmp.x = Math.round(tmp.x / texel) * texel;
      tmp.y = Math.round(tmp.y / texel) * texel;
      tmp.z = Math.round(tmp.z / texel) * texel;
      sun.target.position.copy(tmp);
      sun.position.copy(tmp).addScaledVector(this.sunDirection, 250);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      scene.remove(sky, sun, sun.target, hemi);
      sky.geometry.dispose();
      sky.material.dispose();
      sun.shadow.map?.dispose();
      sun.dispose();
      hemi.dispose();
      env.dispose();
      scene.environment = null;
      scene.fog = null;
    },
  };
}
