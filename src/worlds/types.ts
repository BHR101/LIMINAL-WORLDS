import type * as THREE from 'three';
import type { CollisionWorld } from '../player/CollisionSystem';
import type { Atmosphere } from '../rendering/Lighting';
import type { QualityProfile } from '../rendering/Quality';
import type { PortalDef } from '../architecture/Portals';

export type SoundscapeId = 'cathedral' | 'ascent' | 'obsidian' | 'house' | 'horizon';

export interface Arrival {
  position: THREE.Vector3;
  yaw: number;
  pitch?: number;
}

export interface CinematicShot {
  /** Camera positions (Catmull-Rom spline). */
  points: THREE.Vector3[];
  /** Look-at targets (spline, same count or fewer). */
  look: THREE.Vector3[];
  duration: number;
}

export interface DiscoverySpot {
  id: string;
  position: THREE.Vector3;
  radius: number;
  /** proximity: walk into it; interact: press E; view: stand in it and look at `lookAt`. */
  mode: 'proximity' | 'interact' | 'view';
  label?: string;
  lookAt?: THREE.Vector3;
  onDiscover?: () => void;
}

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  label: string;
  onInteract: () => void;
}

export interface Trigger {
  position: THREE.Vector3;
  radius: number;
  /** Optional vertical tolerance (defaults to radius). */
  height?: number;
  once?: boolean;
  onEnter: () => void;
}

export interface SoundEmitter {
  position: THREE.Vector3;
  kind: 'hum' | 'chime' | 'water';
  /** Audible radius in metres. */
  radius: number;
  pitch?: number;
}

/** Services the engine exposes to worlds for scripted moments. */
export interface WorldServices {
  toast(text: string): void;
  sound(kind: 'chime' | 'resonance' | 'whoosh' | 'reveal'): void;
  revealPortal(id: string): void;
  discover(id: string): void;
  /** Temporarily take the camera along a shot, then return control. */
  cameraMove(shot: CinematicShot, onDone?: () => void): void;
  isDiscovered(id: string): boolean;
  reducedMotion(): boolean;
}

export interface WorldContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  quality: QualityProfile;
  seed: number;
  services: WorldServices;
}

export interface WorldInstance {
  id: string;
  name: string;
  subtitle: string;
  root: THREE.Group;
  collision: CollisionWorld;
  atmosphere: Atmosphere;
  spawn: Arrival;
  arrivals: Record<string, Arrival>;
  killY: number;
  cinematic: CinematicShot[];
  portals: PortalDef[];
  discoveries: DiscoverySpot[];
  interactables: Interactable[];
  triggers: Trigger[];
  emitters: SoundEmitter[];
  soundscape: SoundscapeId;
  seed?: number;
  update(dt: number, t: number, eye: THREE.Vector3): void;
  dispose(): void;
}

export interface WorldDefinition {
  id: string;
  numeral: string;
  name: string;
  tagline: string;
  description: string;
  build(ctx: WorldContext): WorldInstance;
}
