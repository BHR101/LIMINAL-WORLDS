import type { ArchBuilder } from './Builder';
import type { RNG } from '../core/rng';

export interface TowerSpec {
  x: number;
  z: number;
  y0?: number;
  width: number;
  depth?: number;
  height: number;
  tiers?: number;
  /** Fractional shrink per tier. */
  setback?: number;
  mat: string;
  /** Window/slot material; omitted for blank monoliths. */
  windowMat?: string;
  windowRows?: number;
  windowCols?: number;
  rotY?: number;
  collide?: boolean;
  castShadow?: boolean;
}

/** Tiered tower with optional facade pattern of recessed slots. */
export function tower(b: ArchBuilder, s: TowerSpec): void {
  const y0 = s.y0 ?? 0;
  const tiers = s.tiers ?? 1;
  const depth = s.depth ?? s.width;
  let y = y0;
  let w = s.width;
  let d = depth;
  const tierH = s.height / tiers;
  for (let i = 0; i < tiers; i++) {
    const h = i === tiers - 1 ? s.height - (y - y0) : tierH * (1 - i * 0.08);
    b.box(s.x, y, s.z, w, h, d, s.mat, { rotY: s.rotY, collide: s.collide, castShadow: s.castShadow });
    if (s.windowMat) facade(b, s.x, y, s.z, w, h, d, s.windowMat, s.windowRows ?? Math.max(2, Math.floor(h / 6)), s.windowCols ?? Math.max(2, Math.floor(w / 4)), s.rotY ?? 0);
    y += h;
    w *= 1 - (s.setback ?? 0.15);
    d *= 1 - (s.setback ?? 0.15);
  }
}

/** Slots on all four faces of a box. */
export function facade(b: ArchBuilder, x: number, y0: number, z: number, w: number, h: number, d: number, mat: string, rows: number, cols: number, rotY = 0): void {
  const slotW = (w / cols) * 0.32;
  const slotH = (h / rows) * 0.55;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const place = (lx: number, ly: number, lz: number, sx: number, sz: number) => {
    b.box(x + lx * c + lz * s, ly, z - lx * s + lz * c, sx, slotH, sz, mat, { rotY, collide: false, castShadow: false });
  };
  for (let r = 0; r < rows; r++) {
    const ly = y0 + (h / rows) * (r + 0.25);
    for (let i = 0; i < cols; i++) {
      const lx = -w / 2 + (w / cols) * (i + 0.5);
      place(lx, ly, d / 2 + 0.02, slotW, 0.1);
      place(lx, ly, -d / 2 - 0.02, slotW, 0.1);
    }
    const dcols = Math.max(1, Math.round((cols * d) / w));
    for (let i = 0; i < dcols; i++) {
      const lz = -d / 2 + (d / dcols) * (i + 0.5);
      place(w / 2 + 0.02, ly, lz, 0.1, (d / dcols) * 0.32);
      place(-w / 2 - 0.02, ly, lz, 0.1, (d / dcols) * 0.32);
    }
  }
}

/** A distant skyline ring: many cheap towers arranged in an annulus. */
export function skyline(
  b: ArchBuilder,
  rng: RNG,
  opts: { cx: number; cz: number; inner: number; outer: number; count: number; minH: number; maxH: number; mat: string; windowMat?: string; y0?: number },
): void {
  for (let i = 0; i < opts.count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(opts.inner, opts.outer);
    const w = rng.range(6, 22);
    tower(b, {
      x: opts.cx + Math.cos(a) * r,
      z: opts.cz + Math.sin(a) * r,
      y0: opts.y0 ?? 0,
      width: w,
      depth: w * rng.range(0.6, 1.4),
      height: rng.range(opts.minH, opts.maxH),
      tiers: rng.int(1, 3),
      mat: opts.mat,
      windowMat: opts.windowMat && rng.chance(0.5) ? opts.windowMat : undefined,
      rotY: rng.chance(0.3) ? rng.range(0, Math.PI) : 0,
      collide: false,
      castShadow: false,
    });
  }
}

/** A tower hanging from a ceiling at `ceilingY`, tapering downward — for inverted cities. */
export function hangingTower(b: ArchBuilder, s: { x: number; z: number; ceilingY: number; width: number; height: number; tiers?: number; mat: string; windowMat?: string; rotY?: number }): void {
  const tiers = s.tiers ?? 3;
  let top = s.ceilingY;
  let w = s.width;
  for (let i = 0; i < tiers; i++) {
    const h = (s.height / tiers) * (1 - i * 0.1);
    b.box(s.x, top - h, s.z, w, h, w, s.mat, { rotY: s.rotY, collide: false, castShadow: false });
    if (s.windowMat) facade(b, s.x, top - h, s.z, w, h, w, s.windowMat, Math.max(2, Math.floor(h / 7)), Math.max(2, Math.floor(w / 5)), s.rotY ?? 0);
    top -= h;
    w *= 0.78;
  }
  // A spire pointing down.
  b.box(s.x, top - s.height * 0.12, s.z, w * 0.25, s.height * 0.12, w * 0.25, s.mat, { rotY: s.rotY, collide: false, castShadow: false });
}
