import * as THREE from 'three';
import { InputManager } from './InputManager';
import { Settings, safeStorage, type SettingsData } from './Settings';
import { randomSeed } from './rng';
import { QUALITY, type QualityProfile } from '../rendering/Quality';
import { PostProcessing } from '../rendering/PostProcessing';
import { PlayerController } from '../player/PlayerController';
import { PortalSystem, type PortalInstance } from '../systems/PortalSystem';
import { CinematicCamera } from '../systems/CinematicCamera';
import { AudioSystem } from '../systems/AudioSystem';
import { DiscoverySystem } from '../systems/DiscoverySystem';
import { PerformanceMonitor } from '../systems/PerformanceMonitor';
import { captureCanvas, type CaptureResult } from '../systems/ScreenshotSystem';
import { getWorld, MENU_WORLD } from '../worlds/WorldRegistry';
import { discoveryInfo } from '../worlds/discoveries';
import type { CinematicShot, Interactable, WorldDefinition, WorldInstance, WorldServices } from '../worlds/types';

export type Mode = 'boot' | 'menu' | 'playing' | 'paused' | 'photo' | 'transition';

/** UI surface the engine drives. Implemented in src/ui. */
export interface EngineUI {
  showTitle(show: boolean): void;
  showPause(show: boolean): void;
  setPrompt(text: string | null): void;
  toast(title: string, body?: string): void;
  announceWorld(numeral: string, name: string, subtitle: string): void;
  showHints(): void;
  setLockHint(show: boolean): void;
  setHudVisible(show: boolean): void;
  showPhoto(show: boolean): void;
  setCinematicBadge(show: boolean): void;
  setLoading(text: string | null): void;
  photoResult(r: CaptureResult): void;
}

interface Glide {
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  t: number;
  duration: number;
  onDone: () => void;
}

interface Tween {
  t: number;
  duration: number;
  fn: (k: number) => void;
  resolve: () => void;
}

const _fwd = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 6000);
  readonly input: InputManager;
  readonly settings: Settings;
  readonly player: PlayerController;
  readonly portals: PortalSystem;
  readonly audio = new AudioSystem();
  readonly discoveries: DiscoverySystem;
  readonly perf: PerformanceMonitor;
  readonly cine = new CinematicCamera();
  post: PostProcessing;
  quality: QualityProfile;
  ui: EngineUI | null = null;

  mode: Mode = 'boot';
  world: WorldInstance | null = null;
  worldDef: WorldDefinition | null = null;
  worldSeed = 0;
  cinematicMode = false;
  /** Settings "camera mode": start worlds in the cinematic tour. */
  preferCinematic = false;
  photo = {
    freeze: true,
    orbit: false,
    orbitCenter: new THREE.Vector3(),
    orbitYaw: 0,
    orbitPitch: 0,
    orbitDist: 8,
    yaw: 0,
    pitch: 0,
    fov: 70,
    exposure: 0,
    focus: 10,
    aperture: 0,
    lighting: 'natural' as 'natural' | 'golden' | 'blue' | 'noir',
  };
  captures: { filename: string; url: string; thumb: string }[] = [];

  private clock = new THREE.Timer();
  private worldTime = 0;
  private glide: Glide | null = null;
  private tweens: Tween[] = [];
  private scripted: CinematicCamera | null = null;
  private prevEye = new THREE.Vector3();
  private firedTriggers = new Set<number>();
  private titleFog = 0;
  private autoWalk: { from: THREE.Vector3; to: THREE.Vector3; t: number; duration: number } | null = null;
  private fadeAmount = 0;
  private fadeColor = new THREE.Color(0x000000);
  private baseExposure = 1;
  private storage = safeStorage();

  constructor(private container: HTMLElement) {
    this.settings = new Settings(this.storage);
    this.quality = QUALITY[this.settings.data.graphics];
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.maxPixelRatio));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Liminal Worlds 3D view');

    this.input = new InputManager(this.renderer.domElement);
    this.player = new PlayerController(this.input);
    this.portals = new PortalSystem(this.renderer, this.scene, this.quality);
    this.discoveries = new DiscoverySystem(this.storage);
    this.perf = new PerformanceMonitor(this.renderer);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera, this.quality);
    this.scene.add(this.camera);

    this.applySettings(this.settings.data);
    this.settings.onChange((d, key) => this.onSettingChanged(d, key));
    this.player.onFallRecovered = () => void this.flash(0x000000, 0.5);
    this.discoveries.onDiscover((id) => {
      const info = discoveryInfo(id);
      if (info) this.ui?.toast(info.title, `Discovery ${this.discoveries.count} of ${this.discoveries.total}`);
      this.audio.play('chime');
    });

    this.input.onAction((code, e) => this.onAction(code, e));
    this.input.onLockChange((locked) => this.onLockChange(locked));
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.input.isLocked && !this.cinematicMode) this.input.requestLock();
    });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      if (this.mode === 'playing' && !this.cinematicMode) this.pause();
    });
    document.addEventListener('visibilitychange', () => this.audio.suspend(document.hidden));
    this.resize();
  }

  // ------------------------------------------------------------------ lifecycle

  async boot(): Promise<void> {
    this.ui?.setLoading('Assembling architecture…');
    await nextFrame();
    this.loadWorld(MENU_WORLD, 0);
    this.mode = 'menu';
    this.titleFog = 1;
    this.cine.loop = true;
    this.cine.setShots(this.world!.cinematic);
    this.ui?.setLoading(null);
    this.ui?.showTitle(true);
    this.ui?.setHudVisible(false);
    this.clock.connect(document);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private services(): WorldServices {
    return {
      toast: (t) => this.ui?.toast(t),
      sound: (k) => this.audio.play(k),
      revealPortal: (id) => this.portals.reveal(id),
      discover: (id) => this.discoveries.mark(id),
      cameraMove: (shot, onDone) => this.playScripted(shot, onDone),
      isDiscovered: (id) => this.discoveries.isFound(id),
      reducedMotion: () => this.settings.data.reducedMotion,
    };
  }

  loadWorld(id: string, seed: number): void {
    const def = getWorld(id);
    if (this.world) {
      this.portals.clear();
      this.world.dispose();
      this.world = null;
    }
    this.firedTriggers.clear();
    this.worldDef = def;
    this.worldSeed = seed;
    this.world = def.build({ renderer: this.renderer, scene: this.scene, quality: this.quality, seed, services: this.services() });
    this.portals.load(this.world.portals, this.world.root);
    const cfg = this.world.atmosphere.config;
    this.baseExposure = cfg.exposure;
    this.renderer.toneMappingExposure = cfg.exposure;
    this.post.bloom.strength = cfg.bloom ?? 0.3;
    this.post.uniforms.uVignette.value = cfg.vignette ?? 0.35;
    this.post.uniforms.uSaturation.value = cfg.saturation ?? 1;
    this.post.uniforms.uWarmth.value = 0;
    this.audio.setSoundscape(this.world.soundscape);
    this.audio.setEmitters(this.world.emitters);
    this.cine.setShots(this.world.cinematic);
    this.camera.fov = this.settings.data.fov;
    this.camera.updateProjectionMatrix();
    this.worldTime = 0;
    // Warm up shaders to avoid a hitch on the first frame.
    this.renderer.compile(this.scene, this.camera);
  }

  /** Enter a world from the menu, pause screen or a portal. */
  async enterWorld(id: string, opts: { seed?: number; arrival?: string; fadeColor?: THREE.ColorRepresentation } = {}): Promise<void> {
    if (this.mode === 'transition') return;
    this.audio.init();
    this.input.requestLock();
    const fromMenu = this.mode === 'menu';
    this.ui?.showTitle(false);
    this.ui?.showPause(false);
    this.cinematicMode = false;
    this.cineFrozen = false;
    this.ui?.setCinematicBadge(false);
    const seed = opts.seed ?? (id === 'random' ? randomSeed() : 0);
    const sameWorld = this.world && this.worldDef?.id === id && seed === this.worldSeed && fromMenu;
    this.mode = 'transition';
    this.player.enabled = false;
    if (!sameWorld) {
      if (opts.fadeColor !== undefined) this.fadeColor.set(opts.fadeColor);
      else this.fadeColor.set(this.world ? this.world.atmosphere.fog.color : 0x000000);
      await this.fadeTo(1, fromMenu ? 1.2 : 0.9);
      this.ui?.setLoading('Assembling architecture…');
      await nextFrame();
      this.loadWorld(id, seed);
      this.ui?.setLoading(null);
    }
    const w = this.world!;
    const arrival = (opts.arrival && w.arrivals[opts.arrival]) || w.spawn;
    this.player.teleport(arrival.position, arrival.yaw, arrival.pitch ?? 0);
    this.player.roll = 0;
    this.titleFog = 0;
    if (!sameWorld) {
      // Start slightly behind and above, then glide into the eyes.
      _fwd.set(-Math.sin(arrival.yaw), 0, -Math.cos(arrival.yaw));
      this.player.eyePosition(this.camera.position).addScaledVector(_fwd, -3.5).add(new THREE.Vector3(0, 1.5, 0));
      this.camera.lookAt(this.player.eyePosition(new THREE.Vector3()).addScaledVector(_fwd, 10));
      void this.fadeTo(0, 1.6);
    }
    this.ui?.announceWorld(this.worldDef!.numeral, w.name, w.subtitle);
    await this.glideToPlayer(sameWorld ? 3.2 : 2.2);
    this.startPlaying();
  }

  /** Test/automation hook: load a world and place the viewer instantly. */
  debugPlace(id: string, opts: { seed?: number; position?: [number, number, number]; yaw?: number; pitch?: number; arrival?: string } = {}): void {
    this.ui?.showTitle(false);
    this.ui?.showPause(false);
    if (this.worldDef?.id !== id || (opts.seed ?? 0) !== this.worldSeed) this.loadWorld(id, opts.seed ?? 0);
    const w = this.world!;
    const a = (opts.arrival && w.arrivals[opts.arrival]) || w.spawn;
    this.player.teleport(opts.position ? new THREE.Vector3(...opts.position) : a.position, opts.yaw ?? a.yaw, opts.pitch ?? 0);
    this.titleFog = 0;
    this.glide = null;
    this.fadeAmount = 0;
    this.cinematicMode = false;
    this.startPlaying();
    this.player.applyToCamera(this.camera);
  }

  /** Capture/automation hook: hold the camera at a point along a world's cinematic shot. */
  debugCinematic(id: string, index: number, t01: number, seed = 0): void {
    if (this.worldDef?.id !== id || seed !== this.worldSeed) this.loadWorld(id, seed);
    this.ui?.showTitle(false);
    this.ui?.showPause(false);
    this.ui?.setHudVisible(false);
    this.mode = 'menu';
    this.titleFog = 0;
    this.glide = null;
    this.fadeAmount = 0;
    this.cinematicMode = false;
    const shots = this.world!.cinematic;
    this.cine.setShots(shots);
    this.cine.seek(index, t01 * shots[index % shots.length].duration);
    this.cineFrozen = true;
  }

  private cineFrozen = false;

  private startPlaying(): void {
    this.mode = 'playing';
    this.player.enabled = true;
    this.input.consumeMouse();
    this.ui?.setHudVisible(true);
    this.ui?.showHints();
    this.ui?.setLockHint(!this.input.isLocked);
    this.player.eyePosition(this.prevEye);
    if (this.preferCinematic) this.toggleCinematic(true);
  }

  pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.autoWalk = null;
    this.input.exitLock();
    this.ui?.setPrompt(null);
    this.ui?.showPause(true);
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.audio.init();
    this.ui?.showPause(false);
    this.input.requestLock();
    this.mode = 'playing';
    this.ui?.setLockHint(!this.input.isLocked);
    this.input.consumeMouse();
  }

  async restartWorld(): Promise<void> {
    if (!this.worldDef) return;
    const id = this.worldDef.id;
    const seed = this.worldSeed;
    this.mode = 'paused';
    this.ui?.showPause(false);
    this.worldDef = null; // force a rebuild
    await this.enterWorldInternal(id, seed);
  }

  private async enterWorldInternal(id: string, seed: number): Promise<void> {
    this.mode = 'paused';
    await this.enterWorld(id, { seed });
  }

  toTitle(): void {
    this.ui?.showPause(false);
    this.input.exitLock();
    this.mode = 'menu';
    this.cinematicMode = false;
    this.ui?.setCinematicBadge(false);
    this.ui?.setHudVisible(false);
    this.ui?.setPrompt(null);
    this.cine.loop = true;
    if (this.world) this.cine.setShots(this.world.cinematic);
    this.ui?.showTitle(true);
  }

  // ------------------------------------------------------------------ modes

  toggleCinematic(force?: boolean): void {
    const on = force ?? !this.cinematicMode;
    if (on === this.cinematicMode) return;
    if (on) {
      if (this.mode === 'paused') {
        this.ui?.showPause(false);
        this.mode = 'playing';
      }
      if (this.mode !== 'playing' || !this.world) return;
      this.cinematicMode = true;
      this.cine.loop = true;
      this.cine.setShots(this.world.cinematic);
      this.player.enabled = false;
      this.ui?.setPrompt(null);
      this.ui?.setHudVisible(false);
      this.ui?.setCinematicBadge(true);
    } else {
      this.cinematicMode = false;
      this.ui?.setCinematicBadge(false);
      this.mode = 'transition';
      void this.glideToPlayer(1.4).then(() => {
        this.mode = 'playing';
        this.player.enabled = true;
        this.ui?.setHudVisible(true);
        this.input.consumeMouse();
      });
    }
  }

  enterPhoto(): void {
    if (this.mode !== 'playing' || !this.world) return;
    if (this.cinematicMode) this.toggleCinematicImmediate();
    this.mode = 'photo';
    this.autoWalk = null;
    this.input.exitLock();
    this.input.dragLook = true;
    this.player.applyToCamera(this.camera);
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.photo.yaw = e.y;
    this.photo.pitch = e.x;
    this.photo.fov = this.camera.fov;
    this.photo.orbit = false;
    this.ui?.setPrompt(null);
    this.ui?.setHudVisible(false);
    this.ui?.showPhoto(true);
  }

  exitPhoto(): void {
    if (this.mode !== 'photo') return;
    this.input.dragLook = false;
    this.setPhotoLighting('natural');
    this.photo.exposure = 0;
    this.photo.aperture = 0;
    this.post.bokeh.enabled = false;
    this.renderer.toneMappingExposure = this.baseExposure;
    this.camera.fov = this.settings.data.fov;
    this.camera.updateProjectionMatrix();
    this.ui?.showPhoto(false);
    this.ui?.setHudVisible(true);
    this.input.requestLock();
    this.mode = 'playing';
    this.ui?.setLockHint(!this.input.isLocked);
    this.input.consumeMouse();
  }

  private toggleCinematicImmediate(): void {
    this.cinematicMode = false;
    this.player.enabled = true;
    this.ui?.setCinematicBadge(false);
  }

  setPhotoLighting(preset: 'natural' | 'golden' | 'blue' | 'noir'): void {
    this.photo.lighting = preset;
    const atm = this.world?.atmosphere;
    if (!atm) return;
    const cfg = atm.config;
    atm.sun.color.copy(atm.baseSunColor);
    atm.sun.intensity = atm.baseSunIntensity;
    atm.hemi.intensity = atm.baseHemiIntensity;
    this.post.uniforms.uSaturation.value = cfg.saturation ?? 1;
    this.post.uniforms.uWarmth.value = 0;
    if (preset === 'golden') {
      atm.sun.color.lerp(new THREE.Color(0xffb36b), 0.6);
      atm.sun.intensity *= 1.25;
      this.post.uniforms.uWarmth.value = 1.2;
    } else if (preset === 'blue') {
      atm.sun.color.lerp(new THREE.Color(0x9fb8ff), 0.7);
      atm.sun.intensity *= 0.45;
      atm.hemi.intensity *= 1.3;
      this.post.uniforms.uWarmth.value = -1.4;
    } else if (preset === 'noir') {
      this.post.uniforms.uSaturation.value = 0;
      atm.sun.intensity *= 1.3;
      atm.hemi.intensity *= 0.6;
    }
  }

  applyPhotoCamera(): void {
    this.camera.fov = this.photo.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.toneMappingExposure = this.baseExposure * Math.pow(2, this.photo.exposure);
    const bokeh = this.post.bokeh;
    bokeh.enabled = this.photo.aperture > 0;
    const u = (bokeh as unknown as { uniforms: Record<string, THREE.IUniform> }).uniforms;
    u.focus.value = this.photo.focus;
    u.aperture.value = this.photo.aperture * 0.00002;
    u.maxblur.value = 0.012;
  }

  setPhotoOrbit(on: boolean): void {
    this.photo.orbit = on;
    if (on) {
      this.camera.getWorldDirection(_fwd);
      this.photo.orbitDist = Math.max(2, this.photo.focus);
      this.photo.orbitCenter.copy(this.camera.position).addScaledVector(_fwd, this.photo.orbitDist);
      this.photo.orbitYaw = this.photo.yaw;
      this.photo.orbitPitch = this.photo.pitch;
    } else {
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.photo.yaw = e.y;
      this.photo.pitch = e.x;
    }
  }

  capture(): CaptureResult {
    const result = captureCanvas(this.renderer.domElement, () => this.renderNow(), this.worldDef?.id ?? 'world');
    if (result.ok) {
      this.captures.unshift(result.capture);
      if (this.captures.length > 8) {
        const old = this.captures.pop();
        if (old) URL.revokeObjectURL(old.url);
      }
    }
    return result;
  }

  // ------------------------------------------------------------------ input

  private onAction(code: string, e: KeyboardEvent): void {
    if (code === 'KeyF') {
      this.toggleFullscreen();
      return;
    }
    if (code === 'KeyM') {
      this.settings.set('muted', !this.settings.data.muted);
      this.ui?.toast(this.settings.data.muted ? 'Audio muted' : 'Audio on');
      return;
    }
    if (code === 'Backquote') {
      this.settings.set('showPerf', !this.settings.data.showPerf);
      return;
    }
    if (this.mode === 'photo') {
      if (code === 'Escape' || code === 'KeyP') this.exitPhoto();
      else if (code === 'Enter') {
        e.preventDefault();
        this.ui?.photoResult(this.capture());
      }
      return;
    }
    if (this.mode === 'playing') {
      if (this.cinematicMode) {
        if (['KeyG', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(code)) this.toggleCinematic(false);
        return;
      }
      if (code === 'KeyE') this.interact();
      else if (code === 'KeyG') this.toggleCinematic(true);
      else if (code === 'KeyP') this.enterPhoto();
      else if (code === 'Escape') this.pause();
    } else if (this.mode === 'paused' && code === 'Escape') {
      // Escape cannot re-lock the pointer (no user activation); keep the menu open.
    }
  }

  private onLockChange(locked: boolean): void {
    if (this.mode === 'playing') {
      this.ui?.setLockHint(!locked);
      // Losing the lock while exploring (Esc in the browser) pauses.
      if (!locked && !this.cinematicMode && !this.glide && !this.scripted) this.pause();
    }
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  private nearestInteractable(eye: THREE.Vector3): Interactable | null {
    if (!this.world) return null;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.world.interactables) {
      const d = it.position.distanceTo(eye);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  private interact(): void {
    const eye = this.player.eyePosition(new THREE.Vector3());
    const it = this.nearestInteractable(eye);
    if (it) {
      it.onInteract();
      return;
    }
    this.camera.getWorldDirection(_fwd);
    const p = this.portals.nearest(eye, _fwd);
    if (p) this.usePortal(p);
  }

  private usePortal(p: PortalInstance): void {
    if (p.def.target.kind === 'world') {
      const target = p.def.target;
      if (p.def.discovery) this.discoveries.mark(p.def.discovery);
      this.audio.play('whoosh');
      void this.enterWorld(target.worldId, { arrival: target.arrival, fadeColor: p.def.tint ?? 0xffffff });
      return;
    }
    // Walk the player through the opening; crossing detection does the rest.
    const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(new THREE.Matrix4().copy(p.inverseFrame).invert());
    const to = local(0, 0, -0.8);
    to.y = this.player.position.y;
    const from = local(0, 0, 0.9);
    from.y = this.player.position.y;
    this.autoWalk = { from: this.player.position.clone(), to: from, t: 0, duration: 0.5 };
    this.autoWalkNext = { from, to, t: 0, duration: 0.6 };
  }

  private autoWalkNext: { from: THREE.Vector3; to: THREE.Vector3; t: number; duration: number } | null = null;

  /** Move the viewer through a rendered portal, preserving relative pose. */
  private teleportThrough(p: PortalInstance): void {
    if (!p.transform) return;
    const T = p.transform;
    this.player.applyToCamera(this.camera);
    this.camera.updateMatrixWorld();
    const m = new THREE.Matrix4().multiplyMatrices(T, this.camera.matrixWorld);
    const eye = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    m.decompose(eye, quat, new THREE.Vector3());
    _fwd.set(0, 0, -1).applyQuaternion(quat);
    const yaw = Math.atan2(-_fwd.x, -_fwd.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
    // Residual roll relative to an upright camera with the same yaw/pitch.
    _q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const upNew = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const upFlat = new THREE.Vector3(0, 1, 0).applyQuaternion(_q);
    const rightFlat = new THREE.Vector3(1, 0, 0).applyQuaternion(_q);
    const roll = Math.atan2(-upNew.dot(rightFlat), upNew.dot(upFlat));
    const feet = eye.clone();
    feet.y -= PlayerController.eyeHeight;
    const ground = this.world!.collision.groundHeight(feet.x, feet.z, eye.y, 0.35);
    if (ground > feet.y - 2 && ground < eye.y) feet.y = Math.max(feet.y, ground);
    // Rotate horizontal velocity by the yaw change.
    const vel = this.player.velocity.clone();
    const dYaw = yaw - this.player.yaw;
    this.player.teleport(feet, yaw, pitch);
    this.player.roll = this.settings.data.reducedMotion ? 0 : roll;
    this.player.velocity.set(vel.x * Math.cos(dYaw) + vel.z * Math.sin(dYaw), 0, -vel.x * Math.sin(dYaw) + vel.z * Math.cos(dYaw));
    this.player.eyePosition(this.prevEye);
    this.autoWalk = null;
    this.autoWalkNext = null;
    if (p.def.discovery) this.discoveries.mark(p.def.discovery);
    this.audio.play('whoosh');
  }

  // ------------------------------------------------------------------ camera helpers

  private glideToPlayer(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.glide = { fromPos: this.camera.position.clone(), fromQuat: this.camera.quaternion.clone(), t: 0, duration, onDone: resolve };
    });
  }

  private playScripted(shot: CinematicShot, onDone?: () => void): void {
    if (this.mode !== 'playing') {
      onDone?.();
      return;
    }
    const cam = new CinematicCamera();
    cam.loop = false;
    cam.setShots([shot]);
    this.scripted = cam;
    this.player.enabled = false;
    this.ui?.setPrompt(null);
    this.ui?.setHudVisible(false);
    this.scriptedDone = () => {
      this.scripted = null;
      void this.glideToPlayer(2.2).then(() => {
        this.player.enabled = true;
        this.ui?.setHudVisible(true);
        this.input.consumeMouse();
        onDone?.();
      });
    };
  }

  private scriptedDone: (() => void) | null = null;

  fadeTo(target: number, duration: number): Promise<void> {
    const from = this.fadeAmount;
    return this.tween(duration, (k) => (this.fadeAmount = from + (target - from) * k));
  }

  private async flash(color: THREE.ColorRepresentation, duration: number): Promise<void> {
    this.fadeColor.set(color);
    this.fadeAmount = 1;
    await this.fadeTo(0, duration);
  }

  tween(duration: number, fn: (k: number) => void): Promise<void> {
    return new Promise((resolve) => this.tweens.push({ t: 0, duration: Math.max(0.001, duration), fn, resolve }));
  }

  // ------------------------------------------------------------------ settings

  private applySettings(d: SettingsData): void {
    this.player.sensitivity = d.sensitivity;
    this.player.invertY = d.invertY;
    this.player.headBob = !d.reducedMotion;
    this.audio.setVolume(d.volume);
    this.audio.setMuted(d.muted);
    this.camera.fov = d.fov;
    this.camera.updateProjectionMatrix();
    this.perf.setVisible(d.showPerf);
  }

  private onSettingChanged(d: SettingsData, key: keyof SettingsData): void {
    this.applySettings(d);
    if (key === 'graphics') {
      this.quality = QUALITY[d.graphics];
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.maxPixelRatio));
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      if (this.world) {
        const sun = this.world.atmosphere.sun;
        sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
        sun.shadow.radius = this.quality.softShadows ? 3 : 1;
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      this.post.setQuality(this.quality);
      this.portals.setQuality(this.quality);
      this.resize();
    }
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.maxPixelRatio));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
    this.portals.resize();
    this.scene.traverse((o) => {
      const u = ((o as THREE.Points).material as THREE.ShaderMaterial | undefined)?.uniforms;
      if (u?.uScale && (o as THREE.Points).isPoints) u.uScale.value = (h * this.renderer.getPixelRatio()) / 2;
    });
  }

  // ------------------------------------------------------------------ frame

  private frame(): void {
    this.clock.update();
    const realDt = Math.min(this.clock.getDelta(), 0.1);
    this.perf.tick(realDt, this.quality.preset);
    this.renderer.info.reset();
    const timeScale = this.settings.data.reducedMotion ? 0.35 : 1;
    const frozen = this.mode === 'paused' || (this.mode === 'photo' && this.photo.freeze);
    const dt = frozen ? 0 : realDt;
    this.worldTime += dt * timeScale;

    // Tweens (fades etc.) always run on real time.
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += realDt;
      const k = Math.min(1, tw.t / tw.duration);
      tw.fn(k * k * (3 - 2 * k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }

    const world = this.world;
    if (world) {
      this.updateCamera(realDt, dt, world);
      world.update(dt * timeScale, this.worldTime, this.camera.position);
      this.portals.update(realDt, this.worldTime, this.camera.position);
      if (this.titleFog > 0) {
        // Title: the structure slowly emerges from dense fog.
        this.titleFog = Math.max(0, this.titleFog - realDt / 14);
        const base = world.atmosphere.config.fogDensity;
        world.atmosphere.fog.density = base + (base * 5 - base) * this.titleFog * this.titleFog;
      } else if (this.mode !== 'photo') {
        world.atmosphere.fog.density = world.atmosphere.config.fogDensity;
      }
      this.camera.getWorldDirection(_fwd);
      this.audio.updateListener(this.camera.position, _fwd);
    }

    let fade = this.fadeAmount;
    if ((this.mode === 'menu' || this.cinematicMode) && !this.glide && !this.cineFrozen) fade = Math.max(fade, this.cine.fade * 0.85);
    if (this.scripted) fade = Math.max(fade, 0);
    this.post.uniforms.uFade.value = fade;
    this.post.uniforms.uFadeColor.value.copy(this.fadeAmount > 0 ? this.fadeColor : new THREE.Color(0x000000));
    const letter = this.cinematicMode || this.scripted ? 0.09 : 0;
    const lb = this.post.uniforms.uLetterbox;
    lb.value += (letter - lb.value) * (1 - Math.exp(-realDt * 3));
    this.renderNow(realDt);
  }

  private renderNow(dt = 0): void {
    this.portals.render(this.camera);
    this.post.render(dt);
  }

  private updateCamera(realDt: number, dt: number, world: WorldInstance): void {
    const cam = this.camera;
    if (this.glide) {
      const g = this.glide;
      g.t += realDt;
      const k = Math.min(1, g.t / g.duration);
      const e = k * k * k * (k * (k * 6 - 15) + 10);
      const targetPos = this.player.eyePosition(_v);
      const targetQuat = _q.setFromEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
      cam.position.lerpVectors(g.fromPos, targetPos, e);
      cam.quaternion.slerpQuaternions(g.fromQuat, targetQuat, e);
      if (k >= 1) {
        this.glide = null;
        g.onDone();
      }
      return;
    }
    if (this.mode === 'menu' || this.cinematicMode) {
      this.cine.update(this.cineFrozen && this.mode === 'menu' ? 0 : realDt, cam);
      return;
    }
    if (this.scripted) {
      this.scripted.update(realDt, cam);
      if (this.scripted.finished) {
        const done = this.scriptedDone;
        this.scriptedDone = null;
        done?.();
      }
      return;
    }
    if (this.mode === 'photo') {
      this.updatePhotoCamera(realDt);
      return;
    }
    if (this.mode !== 'playing') return;

    // Scripted walk through a portal opening.
    if (this.autoWalk) {
      const a = this.autoWalk;
      a.t += realDt;
      const k = Math.min(1, a.t / a.duration);
      this.player.position.lerpVectors(a.from, a.to, k);
      this.player.velocity.set(0, 0, 0);
      if (k >= 1) {
        this.autoWalk = this.autoWalkNext;
        this.autoWalkNext = null;
      }
    } else {
      this.player.update(dt, world.collision, world.killY);
    }
    const eye = this.player.eyePosition(new THREE.Vector3());
    const crossed = this.portals.crossed(this.prevEye, eye);
    if (crossed) this.teleportThrough(crossed);
    this.player.applyToCamera(cam);
    this.player.eyePosition(this.prevEye);
    cam.getWorldDirection(_fwd);

    // Prompts, discoveries, triggers.
    const it = this.nearestInteractable(cam.position);
    if (it) this.ui?.setPrompt(it.label);
    else {
      const p = this.portals.nearest(cam.position, _fwd);
      this.ui?.setPrompt(p ? p.def.label : null);
    }
    this.discoveries.check(world.discoveries, cam.position, _fwd);
    world.triggers.forEach((tr, i) => {
      if (tr.once !== false && this.firedTriggers.has(i)) return;
      const d = _v.subVectors(cam.position, tr.position);
      if (d.x * d.x + d.z * d.z < tr.radius * tr.radius && Math.abs(d.y) < (tr.height ?? tr.radius)) {
        if (tr.once === false && this.firedTriggers.has(i)) return;
        this.firedTriggers.add(i);
        tr.onEnter();
      } else if (tr.once === false) {
        this.firedTriggers.delete(i);
      }
    });
  }

  private updatePhotoCamera(dt: number): void {
    const cam = this.camera;
    const m = this.input.consumeMouse();
    const k = 0.003 * this.settings.data.sensitivity;
    const ph = this.photo;
    if (ph.orbit) {
      ph.orbitYaw -= m.dx * k;
      ph.orbitPitch = THREE.MathUtils.clamp(ph.orbitPitch - m.dy * k, -1.4, 1.4);
      const zoom = (this.input.down('KeyW') ? -1 : 0) + (this.input.down('KeyS') ? 1 : 0);
      ph.orbitDist = THREE.MathUtils.clamp(ph.orbitDist + zoom * dt * 6, 1, 200);
      const dir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(ph.orbitPitch, ph.orbitYaw, 0, 'YXZ'));
      cam.position.copy(ph.orbitCenter).addScaledVector(dir, ph.orbitDist);
      cam.lookAt(ph.orbitCenter);
      return;
    }
    ph.yaw -= m.dx * k;
    ph.pitch = THREE.MathUtils.clamp(ph.pitch - m.dy * k, -1.55, 1.55);
    cam.quaternion.setFromEuler(new THREE.Euler(ph.pitch, ph.yaw, 0, 'YXZ'));
    const a = this.input.axis();
    const up = (this.input.down('Space') ? 1 : 0) - (this.input.down('KeyC') || this.input.down('ControlLeft') ? 1 : 0);
    const speed = (this.input.down('ShiftLeft') ? 12 : 3) * dt;
    _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    cam.position.addScaledVector(_fwd, a.z * speed).addScaledVector(right, a.x * speed);
    cam.position.y += up * speed;
  }
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}
