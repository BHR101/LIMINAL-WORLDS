/** Shared GLSL value-noise helpers (cheap enough for full-screen layers). */
export const NOISE_GLSL = /* glsl */ `
float lw_hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float lw_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = lw_hash(i);
  float b = lw_hash(i + vec2(1.0, 0.0));
  float c = lw_hash(i + vec2(0.0, 1.0));
  float d = lw_hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
#ifndef LW_OCTAVES
#define LW_OCTAVES 5
#endif
float lw_fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < LW_OCTAVES; i++) {
    v += a * lw_noise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
`;
