/**
 * A compact collision world for architectural spaces.
 *
 * Everything solid is an axis-aligned box. Boxes whose top is within the
 * player's step height act as floors (stairs are just rows of boxes); taller
 * boxes act as walls. A uniform XZ grid keeps queries cheap even with
 * thousands of boxes.
 */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const CELL = 8;

export class CollisionWorld {
  readonly boxes: AABB[] = [];
  private grid = new Map<number, number[]>();
  private stamp: Uint32Array = new Uint32Array(0);
  private query = 0;

  private static key(cx: number, cz: number): number {
    return ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);
  }

  addBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
    const box: AABB = {
      minX: Math.min(minX, maxX),
      minY: Math.min(minY, maxY),
      minZ: Math.min(minZ, maxZ),
      maxX: Math.max(minX, maxX),
      maxY: Math.max(minY, maxY),
      maxZ: Math.max(minZ, maxZ),
    };
    const index = this.boxes.push(box) - 1;
    const x0 = Math.floor(box.minX / CELL);
    const x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL);
    const z1 = Math.floor(box.maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = CollisionWorld.key(cx, cz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(index);
      }
    }
  }

  /** Box centred at (x, z) whose bottom is y0 and top is y1. */
  addCentered(x: number, z: number, sx: number, sz: number, y0: number, y1: number): void {
    this.addBox(x - sx / 2, y0, z - sz / 2, x + sx / 2, y1, z + sz / 2);
  }

  /** Visit boxes near an XZ rectangle exactly once. */
  private forNear(minX: number, minZ: number, maxX: number, maxZ: number, fn: (b: AABB) => void): void {
    if (this.stamp.length < this.boxes.length) {
      const grown = new Uint32Array(Math.max(64, this.boxes.length * 2));
      grown.set(this.stamp);
      this.stamp = grown;
    }
    const q = ++this.query;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.grid.get(CollisionWorld.key(cx, cz));
        if (!list) continue;
        for (const i of list) {
          if (this.stamp[i] === q) continue;
          this.stamp[i] = q;
          fn(this.boxes[i]);
        }
      }
    }
  }

  /**
   * Highest walkable surface under a circle of `radius` at (x, z) that is no
   * higher than `maxY`. Returns -Infinity when there is nothing below.
   */
  groundHeight(x: number, z: number, maxY: number, radius = 0.3): number {
    let best = -Infinity;
    const r = radius * 0.6; // allow standing a little over edges
    this.forNear(x - r, z - r, x + r, z + r, (b) => {
      if (b.maxY > maxY || b.maxY <= best) return;
      if (x + r < b.minX || x - r > b.maxX || z + r < b.minZ || z - r > b.maxZ) return;
      best = b.maxY;
    });
    return best;
  }

  /** Lowest box bottom above `fromY` overlapping the circle; Infinity when open sky. */
  ceilingHeight(x: number, z: number, fromY: number, radius = 0.3): number {
    let best = Infinity;
    const r = radius * 0.7;
    this.forNear(x - r, z - r, x + r, z + r, (b) => {
      if (b.minY < fromY || b.minY >= best) return;
      if (x + r < b.minX || x - r > b.maxX || z + r < b.minZ || z - r > b.maxZ) return;
      best = b.minY;
    });
    return best;
  }

  /**
   * Push a vertical cylinder (feet at feetY, given height and radius) out of
   * every box that is too tall to step onto. Mutates and returns `pos`.
   */
  resolveWalls(pos: { x: number; z: number }, feetY: number, height: number, radius: number, step: number): { x: number; z: number } {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      this.forNear(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, (b) => {
        if (b.maxY <= feetY + step || b.minY >= feetY + height) return;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) return;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        } else {
          // Centre is inside the box: leave by the nearest face.
          const left = pos.x - b.minX;
          const right = b.maxX - pos.x;
          const back = pos.z - b.minZ;
          const front = b.maxZ - pos.z;
          const m = Math.min(left, right, back, front);
          if (m === left) pos.x = b.minX - radius;
          else if (m === right) pos.x = b.maxX + radius;
          else if (m === back) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
          dx = dz = 0;
        }
        moved = true;
      });
      if (!moved) break;
    }
    return pos;
  }

  get size(): number {
    return this.boxes.length;
  }
}
