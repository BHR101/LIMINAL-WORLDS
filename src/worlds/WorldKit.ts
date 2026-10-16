import * as THREE from 'three';
import { ArchBuilder } from '../architecture/Builder';
import { createAtmosphere, type Atmosphere, type AtmosphereConfig } from '../rendering/Lighting';
import { createDust } from '../rendering/Effects';
import type { WorldContext, WorldInstance } from './types';

export interface Kit {
  ctx: WorldContext;
  b: ArchBuilder;
  atm: Atmosphere;
  /** Extra per-frame logic for the world. */
  onUpdate: ((dt: number, t: number, eye: THREE.Vector3) => void)[];
  onDispose: (() => void)[];
}

export function beginWorld(ctx: WorldContext, materials: Record<string, THREE.Material>, atmosphere: AtmosphereConfig): Kit {
  const b = new ArchBuilder(materials);
  const atm = createAtmosphere(ctx.scene, ctx.renderer, ctx.quality, atmosphere);
  return { ctx, b, atm, onUpdate: [], onDispose: [] };
}

export function addDust(kit: Kit, color: THREE.ColorRepresentation, scale = 1, size = 0.05, opacity = 0.5): THREE.Points {
  const dust = createDust(Math.round(kit.ctx.quality.particles * scale), color, size, 40, opacity);
  kit.b.add(dust);
  return dust;
}

type Partial = Omit<WorldInstance, 'root' | 'collision' | 'atmosphere' | 'update' | 'dispose' | 'arrivals' | 'interactables' | 'triggers' | 'emitters' | 'portals' | 'discoveries'> &
  Pick<Partial2<WorldInstance>, 'arrivals' | 'interactables' | 'triggers' | 'emitters' | 'portals' | 'discoveries'>;
type Partial2<T> = { [K in keyof T]?: T[K] };

/** Finalize geometry and assemble the WorldInstance with shared update/dispose logic. */
export function finishWorld(kit: Kit, w: Partial): WorldInstance {
  const root = kit.b.finalize();
  kit.ctx.scene.add(root);
  const timeUniforms: THREE.IUniform[] = [kit.atm.sky.material.uniforms.uTime];
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    const list = Array.isArray(m) ? m : m ? [m] : [];
    for (const mat of list) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const u = (mat as THREE.ShaderMaterial).uniforms;
      if (u?.uTime) timeUniforms.push(u.uTime);
    }
  });
  return {
    ...w,
    arrivals: w.arrivals ?? {},
    interactables: w.interactables ?? [],
    triggers: w.triggers ?? [],
    emitters: w.emitters ?? [],
    portals: w.portals ?? [],
    discoveries: w.discoveries ?? [],
    root,
    collision: kit.b.collision,
    atmosphere: kit.atm,
    update(dt, t, eye) {
      for (const u of timeUniforms) u.value = t;
      for (const a of kit.b.animators) a(dt, t);
      for (const f of kit.onUpdate) f(dt, t, eye);
      kit.atm.follow(eye);
    },
    dispose() {
      for (const f of kit.onDispose) f();
      kit.ctx.scene.remove(root);
      kit.b.dispose();
      kit.atm.dispose();
    },
  };
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
