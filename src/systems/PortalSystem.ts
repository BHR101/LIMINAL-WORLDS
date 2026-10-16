import * as THREE from 'three';
import { createPortalSurface, frameMatrix, portalTransform, type PortalDef } from '../architecture/Portals';
import type { QualityProfile } from '../rendering/Quality';

export interface PortalInstance {
  def: PortalDef;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  rendered: boolean;
  target: THREE.WebGLRenderTarget | null;
  transform: THREE.Matrix4 | null;
  inverseFrame: THREE.Matrix4;
  exitPlaneNormal: THREE.Vector3;
  exitPoint: THREE.Vector3;
  glow: number;
  ready: number;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _plane = new THREE.Plane();
const _clip = new THREE.Vector4();
const _q4 = new THREE.Vector4();
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

/**
 * Renders "window into elsewhere" portals and detects when the viewer crosses
 * one. Each visible local portal renders the scene from a virtual camera
 * (entry→exit transform applied to the real camera) with an oblique near
 * plane at the exit, into a texture sampled in screen space on the opening.
 */
export class PortalSystem {
  portals: PortalInstance[] = [];
  private virtualCamera = new THREE.PerspectiveCamera();
  private size = new THREE.Vector2();
  maxRenderedPerFrame = 2;
  /** Frames to wait before rendering portals (the sun's shadow map must exist first). */
  skipFrames = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private quality: QualityProfile,
  ) {}

  setQuality(q: QualityProfile): void {
    this.quality = q;
    this.skipFrames = 2;
    this.resize();
  }

  load(defs: PortalDef[], parent: THREE.Object3D): void {
    this.clear();
    this.skipFrames = 2;
    this.renderer.getDrawingBufferSize(this.size);
    for (const def of defs) {
      const rendered = def.target.kind === 'local';
      const target = rendered
        ? new THREE.WebGLRenderTarget(Math.max(64, Math.round(this.size.x * this.quality.portalScale)), Math.max(64, Math.round(this.size.y * this.quality.portalScale)), {
            type: THREE.HalfFloatType,
          })
        : null;
      const mesh = createPortalSurface(def, rendered, target);
      mesh.visible = !def.hidden;
      parent.add(mesh);
      const material = (mesh.material as THREE.Material[])[0] as THREE.ShaderMaterial;
      const exit = def.target.kind === 'local' ? frameMatrix(def.target.position, def.target.rotY, def.target.roll ?? 0) : null;
      this.portals.push({
        def,
        mesh,
        material,
        rendered,
        target,
        transform: portalTransform(def),
        inverseFrame: frameMatrix(def.position, def.rotY).invert(),
        exitPlaneNormal: exit ? new THREE.Vector3(0, 0, -1).transformDirection(exit) : new THREE.Vector3(),
        exitPoint: def.target.kind === 'local' ? def.target.position.clone() : new THREE.Vector3(),
        glow: 0,
        ready: 0,
      });
    }
  }

  reveal(id: string): void {
    const p = this.portals.find((x) => x.def.id === id);
    if (p) {
      p.def.hidden = false;
      p.mesh.visible = true;
    }
  }

  resize(): void {
    this.renderer.getDrawingBufferSize(this.size);
    for (const p of this.portals) {
      p.target?.setSize(Math.max(64, Math.round(this.size.x * this.quality.portalScale)), Math.max(64, Math.round(this.size.y * this.quality.portalScale)));
    }
  }

  /** Position of a point in a portal's local frame (z > 0 is in front). */
  local(p: PortalInstance, world: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(world).applyMatrix4(p.inverseFrame);
  }

  /** Nearest usable portal in front of the viewer, for interaction prompts. */
  nearest(eye: THREE.Vector3, forward: THREE.Vector3, maxDist = 4): PortalInstance | null {
    let best: PortalInstance | null = null;
    let bestD = maxDist;
    for (const p of this.portals) {
      if (p.def.hidden) continue;
      const l = this.local(p, eye, _v);
      if (l.z < -0.2 || Math.abs(l.x) > p.def.width / 2 + 1.5 || Math.abs(l.y) > p.def.height / 2 + 2) continue;
      const d = eye.distanceTo(p.def.position);
      _v2.subVectors(p.def.position, eye).normalize();
      if (d < bestD && _v2.dot(forward) > 0.2) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Returns the portal crossed between two eye positions, if any. */
  crossed(prev: THREE.Vector3, cur: THREE.Vector3): PortalInstance | null {
    for (const p of this.portals) {
      if (!p.rendered || p.def.hidden) continue;
      const a = this.local(p, prev, _v);
      if (a.z <= 0) continue;
      const b = this.local(p, cur, _v2);
      if (b.z > 0) continue;
      const t = a.z / (a.z - b.z);
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (Math.abs(x) <= p.def.width / 2 && Math.abs(y) <= p.def.height / 2 + 0.6) return p;
    }
    return null;
  }

  update(dt: number, t: number, eye: THREE.Vector3): void {
    for (const p of this.portals) {
      const d = eye.distanceTo(p.def.position);
      const want = d < 6 ? 1 - d / 6 : 0;
      p.glow += (want - p.glow) * (1 - Math.exp(-dt * 3));
      p.material.uniforms.uGlow.value = p.glow;
      p.material.uniforms.uTime.value = t;
    }
  }

  /** Render visible portal views. Call before the main scene render. */
  render(camera: THREE.PerspectiveCamera): void {
    if (this.skipFrames > 0) {
      this.skipFrames--;
      return;
    }
    const eye = camera.getWorldPosition(new THREE.Vector3());
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pm);
    const candidates: { p: PortalInstance; d: number }[] = [];
    for (const p of this.portals) {
      p.material.uniforms.uResolution.value.copy(this.drawingSize());
      if (!p.rendered || !p.mesh.visible || !p.transform) continue;
      const l = this.local(p, eye, _v);
      const d = eye.distanceTo(p.def.position);
      if (l.z < -0.05 || d > 90) continue;
      _sphere.set(p.def.position, Math.hypot(p.def.width, p.def.height) * 0.6);
      if (!_frustum.intersectsSphere(_sphere)) continue;
      candidates.push({ p, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    const toRender = candidates.slice(0, this.maxRenderedPerFrame);
    if (toRender.length === 0) return;

    const hidden: THREE.Object3D[] = [];
    for (const p of this.portals) {
      if (p.mesh.visible) {
        p.mesh.visible = false;
        hidden.push(p.mesh);
      }
    }
    const prevTarget = this.renderer.getRenderTarget();
    const prevAutoShadow = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    const vc = this.virtualCamera;
    for (const { p } of toRender) {
      vc.copy(camera, false);
      _pm.multiplyMatrices(p.transform!, camera.matrixWorld);
      _pm.decompose(vc.position, vc.quaternion, vc.scale);
      vc.updateMatrixWorld(true);
      vc.projectionMatrix.copy(camera.projectionMatrix);
      vc.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      this.applyObliqueClip(vc, p);
      this.renderer.setRenderTarget(p.target);
      this.renderer.clear();
      this.renderer.render(this.scene, vc);
      p.ready = 1;
      p.material.uniforms.uReady.value = 1;
    }
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.shadowMap.autoUpdate = prevAutoShadow;
    for (const h of hidden) h.visible = true;
  }

  private drawingSize(): THREE.Vector2 {
    return this.renderer.getDrawingBufferSize(this.size);
  }

  private applyObliqueClip(vc: THREE.PerspectiveCamera, p: PortalInstance): void {
    _plane.setFromNormalAndCoplanarPoint(p.exitPlaneNormal, p.exitPoint);
    _plane.applyMatrix4(vc.matrixWorldInverse);
    // The virtual camera must sit behind the exit plane; skip when it is on or past it.
    if (_plane.constant > -0.05) return;
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = vc.projectionMatrix;
    _q4.x = (Math.sign(_clip.x) + pm.elements[8]) / pm.elements[0];
    _q4.y = (Math.sign(_clip.y) + pm.elements[9]) / pm.elements[5];
    _q4.z = -1.0;
    _q4.w = (1.0 + pm.elements[10]) / pm.elements[14];
    _clip.multiplyScalar(2.0 / _clip.dot(_q4));
    pm.elements[2] = _clip.x;
    pm.elements[6] = _clip.y;
    pm.elements[10] = _clip.z + 1.0;
    pm.elements[14] = _clip.w;
  }

  clear(): void {
    for (const p of this.portals) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.geometry.dispose();
      for (const m of p.mesh.material as THREE.Material[]) m.dispose();
      p.target?.dispose();
    }
    this.portals = [];
  }
}
