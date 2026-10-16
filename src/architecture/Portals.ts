import * as THREE from 'three';

export interface LocalTarget {
  kind: 'local';
  /** Centre of the exit opening. */
  position: THREE.Vector3;
  /** Exit facing: you emerge travelling along this frame's local -Z. */
  rotY: number;
  /** Roll about the travel axis — produces a gravity shift. */
  roll?: number;
}

export interface WorldTarget {
  kind: 'world';
  worldId: string;
  /** Named arrival point in the destination world. */
  arrival?: string;
}

export interface PortalDef {
  id: string;
  /** Centre of the opening. */
  position: THREE.Vector3;
  /** Facing: approaching travellers walk along local -Z. */
  rotY: number;
  width: number;
  height: number;
  target: LocalTarget | WorldTarget;
  label: string;
  /** Discovery unlocked on first use. */
  discovery?: string;
  /** Veil tint for non-rendered portals. */
  tint?: THREE.ColorRepresentation;
  /** Hidden until revealed by a discovery effect. */
  hidden?: boolean;
}

export function frameMatrix(position: THREE.Vector3, rotY: number, roll = 0): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, roll, 'YXZ'));
  return new THREE.Matrix4().compose(position, q, new THREE.Vector3(1, 1, 1));
}

/** Transform taking world-space poses at the entry frame to the exit frame. */
export function portalTransform(def: PortalDef): THREE.Matrix4 | null {
  if (def.target.kind !== 'local') return null;
  const a = frameMatrix(def.position, def.rotY);
  const b = frameMatrix(def.target.position, def.target.rotY, def.target.roll ?? 0);
  return b.multiply(a.invert());
}

const RENDERED_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const RENDERED_FRAG = /* glsl */ `
  uniform sampler2D uView;
  uniform vec2 uResolution;
  uniform float uGlow;
  uniform float uTime;
  uniform float uReady;
  uniform vec3 uTint;
  uniform vec2 uSize;
  varying vec3 vLocal;
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 col = texture2D(uView, uv).rgb;
    // Soft luminous seam around the edges of the opening.
    vec2 e = (uSize * 0.5 - abs(vLocal.xy));
    float edge = min(e.x, e.y);
    float seam = (1.0 - smoothstep(0.0, 0.25, edge)) * (0.35 + 0.65 * uGlow);
    float shimmer = 0.5 + 0.5 * sin(vLocal.y * 6.0 + uTime * 2.0);
    col += uTint * seam * (0.6 + 0.4 * shimmer) * 1.5;
    col = mix(uTint * 0.4, col, uReady);
    gl_FragColor = vec4(col, 1.0);
  }`;

const VEIL_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec2 uSize;
  varying vec3 vLocal;
  float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  void main() {
    vec2 p = vLocal.xy / uSize + 0.5;
    float m = n(p * 4.0 + vec2(0.0, uTime * 0.25)) * 0.6 + n(p * 9.0 - vec2(uTime * 0.2, 0.0)) * 0.4;
    vec2 e = (uSize * 0.5 - abs(vLocal.xy));
    float edge = min(e.x, e.y);
    float core = smoothstep(0.0, min(uSize.x, uSize.y) * 0.5, edge);
    vec3 col = uTint * (0.25 + m * 0.9) * (0.55 + 0.45 * uGlow);
    col += uTint * (1.0 - smoothstep(0.0, 0.18, edge)) * (1.0 + uGlow);
    col = mix(col, uTint * 1.6, core * 0.35 * (0.6 + 0.4 * sin(uTime * 0.8)));
    gl_FragColor = vec4(col, 1.0);
  }`;

/**
 * The visible surface of a portal: a shallow open-fronted box, so the opening
 * stays covered even when the camera's near plane crosses the threshold.
 */
export function createPortalSurface(def: PortalDef, rendered: boolean, renderTarget: THREE.WebGLRenderTarget | null): THREE.Mesh {
  const depth = 0.7;
  const geo = new THREE.BoxGeometry(def.width, def.height, depth);
  geo.translate(0, 0, -depth / 2);
  const uniforms = {
    uView: { value: renderTarget?.texture ?? null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlow: { value: 0 },
    uTime: { value: 0 },
    uReady: { value: 0 },
    uTint: { value: new THREE.Color(def.tint ?? 0xfff1dc) },
    uSize: { value: new THREE.Vector2(def.width, def.height) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: RENDERED_VERT,
    fragmentShader: rendered ? RENDERED_FRAG : VEIL_FRAG,
    side: THREE.BackSide,
    fog: false,
  });
  const hiddenFace = new THREE.MeshBasicMaterial({ visible: false });
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z. The +z face is the open front.
  const mesh = new THREE.Mesh(geo, [mat, mat, mat, mat, hiddenFace, mat]);
  mesh.position.copy(def.position);
  mesh.rotation.set(0, def.rotY, 0);
  mesh.name = `portal:${def.id}`;
  mesh.renderOrder = 5;
  return mesh;
}
