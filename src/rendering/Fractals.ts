/**
 * Fractal distance fields, written twice — once in TypeScript for collision,
 * once in GLSL for rendering — so what you see is exactly what you hit.
 *
 * Both return a conservative signed distance to the *solid*: positive in air.
 */

// ---------------------------------------------------------------- Menger lattice

/**
 * An infinite, exactly self-similar Menger lattice. Space is solid except for
 * square tunnels carved at every power-of-three scale; the origin is a cell
 * corner at every scale, so scaling by 3 about the origin maps the structure
 * onto itself. That is what lets The Infinite Regress zoom forever.
 *
 * `sigma` is the viewer's scale. Bands far below the viewer fade out smoothly
 * (so detail never pops in), and the band range is fixed in local units so a
 * renormalisation (p → 3p, sigma → 3·sigma) yields an identical field.
 */
export const MENGER_K_MIN = -4;
export const MENGER_K_MAX = 6;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function mengerWeight(k: number, sigma: number): number {
  const rel = k - Math.log(sigma) / Math.log(3);
  return smoothstep(-3.5, -2.5, rel);
}

export function mengerSDF(x: number, y: number, z: number, sigma: number): number {
  let d = -1e9;
  for (let k = MENGER_K_MIN; k <= MENGER_K_MAX; k++) {
    const w = mengerWeight(k, sigma);
    if (w <= 0) continue;
    const s = Math.pow(3, k);
    const h = (w * s) / 6;
    const ax = Math.abs((((x % s) + s) % s) - s / 2);
    const ay = Math.abs((((y % s) + s) % s) - s / 2);
    const az = Math.abs((((z % s) + s) % s) - s / 2);
    const cross = Math.min(Math.max(ax, ay), Math.max(ay, az), Math.max(az, ax)) - h;
    if (-cross > d) d = -cross;
  }
  return d;
}

export const MENGER_GLSL = /* glsl */ `
float mengerMap(vec3 p, float sigma, float t, out float band) {
  float d = -1e9;
  band = 0.0;
  float ls = log(sigma) / log(3.0);
  float pixel = t * 0.0015 + 1e-4;
  for (int k = ${MENGER_K_MIN}; k <= ${MENGER_K_MAX}; k++) {
    float fk = float(k);
    float w = smoothstep(-3.5, -2.5, fk - ls);
    float s = pow(3.0, fk);
    // Bands smaller than a pixel at this distance are skipped (antialiasing + speed).
    w *= smoothstep(pixel * 2.0, pixel * 6.0, s / 6.0);
    if (w <= 0.0) continue;
    float h = w * s / 6.0;
    vec3 r = abs(mod(p, s) - 0.5 * s);
    float c = min(min(max(r.x, r.y), max(r.y, r.z)), max(r.z, r.x)) - h;
    if (-c > d) { d = -c; band = fk; }
  }
  return d;
}
`;

// ---------------------------------------------------------------- 4D lattice slice

/**
 * A Menger-style lattice in four dimensions, sliced by the hyperplane w = const.
 * Holes are carved wherever two of the four coordinates sit in the middle third
 * of a cell. Pairs among x, y, z give permanent 3D tunnels; pairs involving w
 * open and close as the slice moves along w, so the architecture rewires
 * itself — walls dissolve into slabs and re-form, slower at larger scales.
 */
export const LATTICE4_K_MIN = -2;
export const LATTICE4_K_MAX = 4;

export function lattice4SDF(x: number, y: number, z: number, w: number): number {
  let d = -1e9;
  for (let k = LATTICE4_K_MIN; k <= LATTICE4_K_MAX; k++) {
    const s = Math.pow(3, k);
    const fade = smoothstep(LATTICE4_K_MIN - 0.5, LATTICE4_K_MIN + 0.5, k);
    const h = (fade * s) / 6;
    const r = (v: number) => Math.abs((((v % s) + s) % s) - s / 2);
    const ax = r(x);
    const ay = r(y);
    const az = r(z);
    // The w-pairs are thinner so the slice only ever opens slits and slabs.
    const aw = r(w) + s * 0.04;
    const c3 = Math.min(Math.max(ax, ay), Math.max(ay, az), Math.max(az, ax));
    const c4 = Math.min(Math.max(ax, aw), Math.max(ay, aw), Math.max(az, aw));
    const cross = Math.min(c3, c4) - h;
    if (-cross > d) d = -cross;
  }
  return d;
}

export const LATTICE4_GLSL = /* glsl */ `
float lattice4Map(vec3 p, float w, float t, out float band) {
  float d = -1e9;
  band = 0.0;
  float pixel = t * 0.0015 + 1e-4;
  for (int k = ${LATTICE4_K_MIN}; k <= ${LATTICE4_K_MAX}; k++) {
    float fk = float(k);
    float s = pow(3.0, fk);
    float fade = smoothstep(${LATTICE4_K_MIN.toFixed(1)} - 0.5, ${LATTICE4_K_MIN.toFixed(1)} + 0.5, fk);
    fade *= smoothstep(pixel * 2.0, pixel * 6.0, s / 6.0);
    if (fade <= 0.0) continue;
    float h = fade * s / 6.0;
    vec3 r = abs(mod(p, s) - 0.5 * s);
    float aw = abs(mod(w, s) - 0.5 * s) + s * 0.04;
    float c3 = min(min(max(r.x, r.y), max(r.y, r.z)), max(r.z, r.x));
    float c4 = min(min(max(r.x, aw), max(r.y, aw)), max(r.z, aw));
    float c = min(c3, c4) - h;
    if (-c > d) { d = -c; band = fk + (c4 < c3 ? 10.0 : 0.0); }
  }
  return d;
}
`;

/** Numerical gradient of a scalar field (for pushing a body out of a wall). */
export function gradient(f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, e: number): [number, number, number] {
  const gx = f(x + e, y, z) - f(x - e, y, z);
  const gy = f(x, y + e, z) - f(x, y - e, z);
  const gz = f(x, y, z + e) - f(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
