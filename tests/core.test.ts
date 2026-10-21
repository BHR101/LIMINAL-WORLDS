import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RNG, hashString } from '../src/core/rng';
import { DEFAULT_SETTINGS, Settings, type KeyValueStore } from '../src/core/Settings';
import { CollisionWorld } from '../src/player/CollisionSystem';
import { PlayerController } from '../src/player/PlayerController';
import { portalTransform, type PortalDef } from '../src/architecture/Portals';
import { ArchBuilder } from '../src/architecture/Builder';
import { arch } from '../src/architecture/Arches';
import { staircase } from '../src/architecture/Staircases';
import { planWorld } from '../src/worlds/WorldGenerator';
import { glide } from '../src/systems/CinematicCamera';
import { DISCOVERIES } from '../src/worlds/discoveries';
import { DiscoverySystem } from '../src/systems/DiscoverySystem';
import { WORLDS } from '../src/worlds/WorldRegistry';
import { mengerSDF, lattice4SDF } from '../src/rendering/Fractals';
import type { InputManager } from '../src/core/InputManager';

const memoryStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
};

describe('RNG', () => {
  it('is deterministic per seed', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(new RNG(43).next()).not.toEqual(seqA[0]);
  });
  it('stays within ranges', () => {
    const r = new RNG(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
      const n = r.int(1, 6);
      expect(Number.isInteger(n) && n >= 1 && n <= 6).toBe(true);
    }
  });
  it('hashes strings stably', () => {
    expect(hashString('liminal')).toBe(hashString('liminal'));
    expect(hashString('liminal')).not.toBe(hashString('worlds'));
  });
});

describe('Settings', () => {
  it('falls back to defaults for corrupt data', () => {
    expect(Settings.parse('{not json')).toEqual(DEFAULT_SETTINGS);
    expect(Settings.parse(null)).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps and validates values', () => {
    const s = Settings.parse(JSON.stringify({ sensitivity: 99, volume: -1, graphics: 'ultra', fov: 10, muted: 'yes' }));
    expect(s.sensitivity).toBe(4);
    expect(s.volume).toBe(0);
    expect(s.graphics).toBe('balanced');
    expect(s.fov).toBe(50);
    expect(s.muted).toBe(false);
  });
  it('persists changes and notifies listeners', () => {
    const store = memoryStore();
    const s = new Settings(store);
    let changed = '';
    s.onChange((_d, k) => (changed = k));
    s.set('volume', 0.25);
    expect(changed).toBe('volume');
    expect(new Settings(store).data.volume).toBe(0.25);
  });
});

describe('CollisionWorld', () => {
  const world = new CollisionWorld();
  world.addBox(-10, -1, -10, 10, 0, 10); // floor
  world.addBox(2, 0, -10, 3, 4, 10); // wall at x 2..3
  world.addBox(-5, 0, -5, -4, 0.3, -4); // low step
  world.addBox(-10, 3, -10, 10, 3.5, -8); // ceiling slab

  it('finds the floor and steps', () => {
    expect(world.groundHeight(0, 0, 0.5)).toBe(0);
    expect(world.groundHeight(-4.5, -4.5, 0.6)).toBeCloseTo(0.3);
    expect(world.groundHeight(50, 50, 10)).toBe(-Infinity);
  });
  it('ignores surfaces above the reach height', () => {
    expect(world.groundHeight(2.5, 0, 0.5)).toBe(0);
  });
  it('pushes a cylinder out of walls', () => {
    const p = { x: 1.9, z: 0 };
    world.resolveWalls(p, 0, 1.8, 0.35, 0.5);
    expect(p.x).toBeCloseTo(2 - 0.35, 5);
  });
  it('lets low steps be walked over', () => {
    const p = { x: -4.5, z: -4.5 };
    world.resolveWalls(p, 0, 1.8, 0.35, 0.5);
    expect(p).toEqual({ x: -4.5, z: -4.5 });
  });
  it('reports ceilings', () => {
    expect(world.ceilingHeight(0, -9, 1)).toBe(3);
    expect(world.ceilingHeight(0, 5, 1)).toBe(Infinity);
  });
});

describe('PlayerController', () => {
  const fakeInput = (keys: string[]) =>
    ({
      consumeMouse: () => ({ dx: 0, dy: 0 }),
      axis: () => ({ x: 0, z: keys.includes('KeyW') ? 1 : 0 }),
      down: (c: string) => keys.includes(c),
    }) as unknown as InputManager;

  it('climbs a staircase built from boxes', () => {
    const b = new ArchBuilder({ m: new THREE.MeshBasicMaterial() });
    b.collision.addBox(-20, -1, -40, 20, 0, 20);
    const top = staircase(b, { x: 0, z: -2, y0: 0, facing: 0, width: 3, steps: 16, rise: 0.25, tread: 0.45, mat: 'm', solid: true });
    b.collision.addBox(-5, 0, top.z - 10, 5, top.y, top.z + 0.01);
    const p = new PlayerController(fakeInput(['KeyW']));
    p.teleport(new THREE.Vector3(0, 0, 0), 0);
    for (let i = 0; i < 60 * 4; i++) p.update(1 / 60, b.collision, -50);
    expect(p.position.y).toBeCloseTo(top.y, 1);
    expect(p.position.z).toBeLessThan(top.z);
  });

  it('cannot walk through a wall', () => {
    const w = new CollisionWorld();
    w.addBox(-20, -1, -20, 20, 0, 20);
    w.addBox(-20, 0, -5.5, 20, 5, -5);
    const p = new PlayerController(fakeInput(['KeyW']));
    p.teleport(new THREE.Vector3(0, 0, 0), 0);
    for (let i = 0; i < 60 * 3; i++) p.update(1 / 60, w, -50);
    expect(p.position.z).toBeGreaterThan(-5);
  });

  it('recovers after falling out of the world', () => {
    const w = new CollisionWorld();
    w.addBox(-2, -1, -2, 2, 0, 2);
    const p = new PlayerController(fakeInput([]));
    p.teleport(new THREE.Vector3(0, 0, 0), 0);
    for (let i = 0; i < 60; i++) p.update(1 / 60, w, -20);
    p.position.set(10, 0, 10);
    let recovered = false;
    p.onFallRecovered = () => (recovered = true);
    for (let i = 0; i < 60 * 5; i++) p.update(1 / 60, w, -20);
    expect(recovered).toBe(true);
    expect(Math.abs(p.position.x)).toBeLessThan(2);
  });
});

describe('Portals', () => {
  const def: PortalDef = {
    id: 't',
    position: new THREE.Vector3(10, 1.5, 0),
    rotY: -Math.PI / 2,
    width: 2,
    height: 3,
    label: '',
    target: { kind: 'local', position: new THREE.Vector3(0, 1.5, -500), rotY: 0 },
  };
  it('maps the entry frame onto the exit frame', () => {
    const T = portalTransform(def)!;
    const p = def.position.clone().applyMatrix4(T);
    expect(p.distanceTo(new THREE.Vector3(0, 1.5, -500))).toBeLessThan(1e-6);
  });
  it('preserves the direction of travel', () => {
    const T = portalTransform(def)!;
    // Travelling +X into the entry should come out travelling -Z at the exit.
    const dir = new THREE.Vector3(1, 0, 0).transformDirection(T);
    expect(dir.z).toBeCloseTo(-1, 6);
  });
  it('applies roll for gravity shifts', () => {
    const rolled: PortalDef = { ...def, target: { kind: 'local', position: new THREE.Vector3(0, 0, 0), rotY: 0, roll: Math.PI } };
    const up = new THREE.Vector3(0, 1, 0).transformDirection(portalTransform(rolled)!);
    expect(up.y).toBeCloseTo(-1, 6);
  });
  it('returns null for cross-world portals', () => {
    expect(portalTransform({ ...def, target: { kind: 'world', worldId: 'x' } })).toBeNull();
  });
});

describe('Architecture builder', () => {
  it('batches instances and creates colliders', () => {
    const b = new ArchBuilder({ stone: new THREE.MeshStandardMaterial() });
    for (let i = 0; i < 10; i++) b.box(i * 3, 0, 0, 1, 2, 1, 'stone');
    arch(b, { x: 0, z: 10, span: 4, legHeight: 5, pier: 1, depth: 1, mat: 'stone' });
    arch(b, { x: 10, z: 10, span: 4, legHeight: 5, pier: 1, depth: 1, mat: 'stone' });
    const root = b.finalize();
    const meshes = root.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(meshes.length).toBe(2); // one box batch, one shared arch geometry batch
    expect(meshes.map((m) => m.count).sort()).toEqual([10, 2]);
    expect(b.collision.size).toBe(10 + 2 * 3);
    b.dispose();
  });
});

describe('Random world planning', () => {
  it('is reproducible from a seed', () => {
    expect(planWorld(1234)).toEqual(planWorld(1234));
  });
  it('varies between seeds', () => {
    const plans = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(planWorld(i + 1))));
    expect(plans.size).toBeGreaterThan(25);
  });
  it('only floats archipelagos over clouds', () => {
    for (let i = 1; i < 200; i++) {
      const p = planWorld(i);
      if (p.layout === 'archipelago') expect(p.ground).toBe('clouds');
    }
  });
});

describe('Cinematic easing', () => {
  it('starts at 0, ends at 1 and never goes backwards', () => {
    expect(glide(0)).toBe(0);
    expect(glide(1)).toBeCloseTo(1, 10);
    let prev = 0;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const v = glide(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });
});

describe('Discoveries', () => {
  it('has unique secrets, at least two in every world, none for unknown worlds', () => {
    expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(DISCOVERIES.length);
    const ids = new Set(WORLDS.map((w) => w.id));
    for (const d of DISCOVERIES) expect(ids.has(d.world)).toBe(true);
    for (const w of WORLDS) expect(DISCOVERIES.filter((d) => d.world === w.id).length).toBeGreaterThanOrEqual(2);
  });
  it('persists found secrets and ignores unknown ids', () => {
    const store = memoryStore();
    const d = new DiscoverySystem(store);
    expect(d.mark('ascent-loop')).toBe(true);
    expect(d.mark('ascent-loop')).toBe(false);
    expect(d.mark('not-a-secret')).toBe(false);
    expect(new DiscoverySystem(store).isFound('ascent-loop')).toBe(true);
  });
  it('triggers walk-in spots only within their radius', () => {
    const d = new DiscoverySystem(memoryStore());
    const spot = { id: 'cathedral-reveal', position: new THREE.Vector3(0, 0, 0), radius: 3, mode: 'proximity' as const };
    d.check([spot], new THREE.Vector3(5, 1.6, 0), new THREE.Vector3(0, 0, -1));
    expect(d.isFound('cathedral-reveal')).toBe(false);
    d.check([spot], new THREE.Vector3(1, 1.6, 0), new THREE.Vector3(0, 0, -1));
    expect(d.isFound('cathedral-reveal')).toBe(true);
  });
});

describe('Fractal fields', () => {
  it('the Menger lattice is self-similar under renormalisation (p → 3p, σ → 3σ)', () => {
    const R0 = 30;
    for (let i = 0; i < 200; i++) {
      const dir = new THREE.Vector3(Math.sin(i * 1.3), Math.cos(i * 0.7), Math.sin(i * 2.1 + 1)).normalize();
      const p = dir.multiplyScalar((R0 / 3) * (1 + (i % 10) * 0.004));
      const s = p.length() / R0;
      const a = mengerSDF(p.x, p.y, p.z, s);
      const b = mengerSDF(p.x * 3, p.y * 3, p.z * 3, s * 3);
      expect(b).toBeCloseTo(3 * a, 6);
    }
  });
  it('the Menger field is mostly air at the viewer scale', () => {
    let air = 0;
    for (let i = 0; i < 400; i++) {
      const p = new THREE.Vector3(Math.sin(i * 12.9898) * 20, Math.sin(i * 78.233) * 20, Math.sin(i * 37.719) * 20);
      if (mengerSDF(p.x, p.y, p.z, p.length() / 30) > 0) air++;
    }
    expect(air / 400).toBeGreaterThan(0.5);
  });
  it('the 4D lattice keeps its great 3D tunnels open for every slice', () => {
    // The centre of a 27 m cell lies on three permanent tunnels.
    for (let w = 0; w < 30; w += 0.37) expect(lattice4SDF(13.5, 13.5, 13.5, w)).toBeGreaterThan(3);
  });
  it('moving the slice along w changes the architecture', () => {
    let changed = 0;
    for (let i = 0; i < 200; i++) {
      const x = (i * 7.31) % 40;
      const y = (i * 3.17) % 40;
      const z = (i * 5.73) % 40;
      if (Math.sign(lattice4SDF(x, y, z, 0.3)) !== Math.sign(lattice4SDF(x, y, z, 1.5))) changed++;
    }
    expect(changed).toBeGreaterThan(5);
  });
});
