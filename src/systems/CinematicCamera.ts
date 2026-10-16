import * as THREE from 'three';
import type { CinematicShot } from '../worlds/types';

const ease = (t: number) => t * t * (3 - 2 * t);

/** Constant-acceleration ramps at both ends with a linear glide in between. */
export function glide(t: number, k = 0.15): number {
  const n = 1 - k;
  if (t < k) return (t * t) / (2 * k) / n;
  if (t > 1 - k) return 1 - ((1 - t) * (1 - t)) / (2 * k) / n;
  return (t - k / 2) / n;
}

/**
 * Plays a sequence of spline shots with eased speed and soft dips between
 * them. `fade` is exposed so the engine can drive the grade pass.
 */
export class CinematicCamera {
  private shots: { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3; duration: number }[] = [];
  private index = 0;
  private time = 0;
  /** 0..1 amount of fade to apply at shot boundaries. */
  fade = 0;
  loop = true;
  finished = false;
  private lookTmp = new THREE.Vector3();

  setShots(shots: CinematicShot[], startIndex = 0): void {
    this.shots = shots.map((s) => ({
      pos: new THREE.CatmullRomCurve3(s.points, false, 'centripetal'),
      look: new THREE.CatmullRomCurve3(s.look.length > 1 ? s.look : [s.look[0], s.look[0].clone().add(new THREE.Vector3(0, 0.001, 0))], false, 'centripetal'),
      duration: s.duration,
    }));
    this.index = shots.length ? startIndex % shots.length : 0;
    this.time = 0;
    this.finished = false;
  }

  /** Jump to a time (seconds) within a shot. */
  seek(index: number, time: number): void {
    if (!this.shots.length) return;
    this.index = ((index % this.shots.length) + this.shots.length) % this.shots.length;
    this.time = time;
    this.finished = false;
  }

  get active(): boolean {
    return this.shots.length > 0 && !this.finished;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (!this.shots.length) return;
    const shot = this.shots[this.index];
    this.time += dt;
    if (this.time >= shot.duration) {
      if (this.index === this.shots.length - 1 && !this.loop) {
        this.finished = true;
        this.time = shot.duration;
      } else {
        this.index = (this.index + 1) % this.shots.length;
        this.time = 0;
      }
    }
    const s = this.shots[this.index];
    // Gentle acceleration at the ends of each shot, constant glide in between.
    const t = THREE.MathUtils.clamp(glide(Math.min(1, this.time / s.duration)), 0, 1);
    s.pos.getPointAt(t, camera.position);
    s.look.getPointAt(t, this.lookTmp);
    camera.lookAt(this.lookTmp);
    const edge = 1.6;
    const fromStart = this.time;
    const toEnd = s.duration - this.time;
    const dip = this.shots.length > 1 || this.loop ? Math.max(0, 1 - Math.min(fromStart, toEnd) / edge) : 0;
    this.fade = this.finished ? 0 : ease(dip);
  }
}
