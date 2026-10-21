import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { CollisionWorld } from './CollisionSystem';

const EYE = 1.65;
const HEIGHT = 1.8;
const RADIUS = 0.35;
const STEP = 0.55;
const GRAVITY = 19;
const WALK = 4.4;
const SPRINT = 8.5;
const JUMP = 6.2;

/** First-person walker with gravity, step-up, ground snapping and fall recovery. */
export class PlayerController {
  readonly position = new THREE.Vector3(); // feet
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  /** Extra camera roll, eased back to zero (used by gravity-shifting portals). */
  roll = 0;
  grounded = false;
  sensitivity = 1;
  invertY = false;
  headBob = true;
  enabled = true;
  /** Optional per-frame gravity scale (low-gravity rooms). */
  gravityScale = 1;
  /** Free flight through a distance field (fractal worlds) instead of walking. */
  fly = false;
  /** Signed distance to solid matter, positive in air (fly mode). */
  sdf: ((p: THREE.Vector3) => number) | null = null;
  /** Body size multiplier (fractal worlds shrink and grow the viewer). */
  scale = 1;

  private eyeOffset = EYE;
  private bobPhase = 0;
  private lastSafe = new THREE.Vector3();
  private lastSafeYaw = 0;
  private safeTimer = 0;
  private airTime = 0;
  onFallRecovered: (() => void) | null = null;

  constructor(private input: InputManager) {}

  teleport(pos: THREE.Vector3, yaw?: number, pitch = 0): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = pitch;
    this.lastSafe.copy(pos);
    this.lastSafeYaw = this.yaw;
    this.eyeOffset = EYE;
    this.airTime = 0;
  }

  /** Scale the whole body state about the origin (fractal renormalisation). */
  rescale(factor: number): void {
    this.position.multiplyScalar(factor);
    this.velocity.multiplyScalar(factor);
    this.lastSafe.multiplyScalar(factor);
  }

  eyePosition(target: THREE.Vector3): THREE.Vector3 {
    if (this.fly) return target.copy(this.position);
    const bob = this.headBob ? Math.sin(this.bobPhase * 2) * 0.035 : 0;
    return target.set(this.position.x, this.position.y + this.eyeOffset + bob, this.position.z);
  }

  applyToCamera(camera: THREE.Camera): void {
    this.eyePosition(camera.position);
    const sway = this.headBob ? Math.sin(this.bobPhase) * 0.0035 : 0;
    camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll + sway, 'YXZ'));
  }

  update(dt: number, world: CollisionWorld, killY: number): void {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);
    if (this.fly) {
      this.updateFly(dt);
      return;
    }

    const mouse = this.input.consumeMouse();
    const k = 0.0022 * this.sensitivity;
    this.yaw -= mouse.dx * k;
    this.pitch -= mouse.dy * k * (this.invertY ? -1 : 1);
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    this.roll *= Math.exp(-dt * 2.2);
    if (Math.abs(this.roll) < 1e-3) this.roll = 0;

    const axis = this.input.axis();
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const speed = sprint ? SPRINT : WALK;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    // right vector = (cos yaw, 0, -sin yaw)
    let wx = fx * axis.z + Math.cos(this.yaw) * axis.x;
    let wz = fz * axis.z - Math.sin(this.yaw) * axis.x;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }
    const control = this.grounded ? 12 : 3;
    const blend = 1 - Math.exp(-control * dt);
    this.velocity.x += (wx * speed - this.velocity.x) * blend;
    this.velocity.z += (wz * speed - this.velocity.z) * blend;

    if (this.grounded && this.input.down('Space')) {
      this.velocity.y = JUMP;
      this.grounded = false;
    }
    this.velocity.y -= GRAVITY * this.gravityScale * dt;

    // Sub-step to avoid tunnelling through thin walls at sprint speed.
    const steps = Math.max(1, Math.ceil((Math.hypot(this.velocity.x, this.velocity.z) * dt) / 0.2));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.integrate(h, world);

    const moving = len > 0 && this.grounded;
    if (moving) this.bobPhase += dt * (sprint ? 11 : 7.5);
    this.eyeOffset += (EYE - this.eyeOffset) * (1 - Math.exp(-dt * 14));

    if (this.grounded) {
      this.airTime = 0;
      this.safeTimer += dt;
      if (this.safeTimer > 0.5) {
        this.safeTimer = 0;
        this.lastSafe.copy(this.position);
        this.lastSafeYaw = this.yaw;
      }
    } else {
      this.airTime += dt;
    }

    if (this.position.y < killY || this.airTime > 9) {
      this.teleport(this.lastSafe.clone().add(new THREE.Vector3(0, 0.05, 0)), this.lastSafeYaw);
      this.onFallRecovered?.();
    }
  }

  private updateFly(dt: number): void {
    const mouse = this.input.consumeMouse();
    const k = 0.0022 * this.sensitivity;
    this.yaw -= mouse.dx * k;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - mouse.dy * k * (this.invertY ? -1 : 1)));
    this.roll *= Math.exp(-dt * 2.2);
    const axis = this.input.axis();
    const rise = (this.input.down('Space') ? 1 : 0) - (this.input.down('KeyC') || this.input.down('ControlLeft') ? 1 : 0);
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const want = new THREE.Vector3(axis.x, 0, -axis.z).applyQuaternion(q);
    want.y += rise;
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar((sprint ? 14 : 5) * this.scale);
    this.velocity.lerp(want, 1 - Math.exp(-dt * 4));
    const radius = 0.4 * this.scale;
    const steps = Math.max(1, Math.ceil((this.velocity.length() * dt) / (radius * 0.5)));
    for (let i = 0; i < steps; i++) {
      this.position.addScaledVector(this.velocity, dt / steps);
      this.pushOut(radius);
    }
    if (this.sdf && this.sdf(this.position) > radius * 0.5) {
      this.safeTimer += dt;
      if (this.safeTimer > 0.3) {
        this.safeTimer = 0;
        this.lastSafe.copy(this.position);
      }
    } else if (this.sdf && this.sdf(this.position) < -radius) {
      // Somehow inside the solid: go back to the last clear spot.
      this.position.copy(this.lastSafe);
      this.velocity.set(0, 0, 0);
      this.onFallRecovered?.();
    }
  }

  /** Push the body out of a distance field and cancel velocity into the wall. */
  private pushOut(radius: number): void {
    const f = this.sdf;
    if (!f) return;
    const p = this.position;
    const e = radius * 0.25;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      const d = f(p);
      if (d >= radius) return;
      const gx = f(tmp.set(p.x + e, p.y, p.z)) - f(tmp.set(p.x - e, p.y, p.z));
      const gy = f(tmp.set(p.x, p.y + e, p.z)) - f(tmp.set(p.x, p.y - e, p.z));
      const gz = f(tmp.set(p.x, p.y, p.z + e)) - f(tmp.set(p.x, p.y, p.z - e));
      const n = tmp.set(gx, gy, gz);
      if (n.lengthSq() < 1e-12) return;
      n.normalize();
      p.addScaledVector(n, radius - d);
      const into = this.velocity.dot(n);
      if (into < 0) this.velocity.addScaledVector(n, -into);
    }
  }

  private integrate(dt: number, world: CollisionWorld): void {
    const p = this.position;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    world.resolveWalls(p, p.y, HEIGHT, RADIUS, STEP);

    const prevY = p.y;
    p.y += this.velocity.y * dt;
    const head = world.ceilingHeight(p.x, p.z, prevY + 0.5, RADIUS);
    if (p.y + HEIGHT > head && this.velocity.y > 0) {
      p.y = head - HEIGHT;
      this.velocity.y = 0;
    }

    const ground = world.groundHeight(p.x, p.z, Math.max(prevY, p.y) + STEP, RADIUS);
    const wasGrounded = this.grounded;
    if (this.velocity.y <= 0 && p.y <= ground + 0.001) {
      this.landAt(ground, prevY);
    } else if (wasGrounded && this.velocity.y <= 0 && ground > -Infinity && p.y - ground < STEP) {
      // Snap down when walking down stairs instead of skipping off each step.
      this.landAt(ground, prevY);
    } else {
      this.grounded = false;
    }
  }

  private landAt(ground: number, prevY: number): void {
    const p = this.position;
    // Keep the eye smooth when stepping up or down.
    this.eyeOffset -= ground - prevY;
    this.eyeOffset = Math.max(EYE - 0.6, Math.min(EYE + 0.6, this.eyeOffset));
    p.y = ground;
    this.velocity.y = 0;
    this.grounded = true;
  }

  static get eyeHeight(): number {
    return EYE;
  }
}
