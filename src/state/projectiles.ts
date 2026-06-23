// Projectile storage — same SoA-over-typed-arrays pool as enemies. Active set
// packed in [0,count), O(1) swap-remove on despawn, zero per-frame allocation.
// Holds both straight-line projectiles (Dagger) and gravity ones (Axe); `kind`
// tags which, so movement and the renderer can branch.

export const PROJECTILE_CAPACITY = 512;

// Projectile kinds — drive gravity/despawn behavior and which visual pool draws it.
export const PROJ_DAGGER = 0;
export const PROJ_AXE = 1;

// Sentinel pierce: never consumed. The projectile passes through every enemy and
// only ends by leaving the world (or lifetime). Used by axes.
export const PIERCE_INFINITE = -1;

export class Projectiles {
  readonly capacity: number;
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly velX: Float32Array;
  readonly velY: Float32Array;
  readonly life: Float32Array; // remaining lifetime (s)
  readonly radius: Float32Array;
  readonly damage: Float32Array;
  readonly pierce: Int16Array; // remaining enemies it can pass through
  readonly gravity: Float32Array; // downward accel (px/s²); 0 = straight-line
  readonly spin: Float32Array; // current visual rotation (rad)
  readonly kind: Uint8Array; // PROJ_DAGGER | PROJ_AXE

  constructor(capacity: number) {
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.velX = new Float32Array(capacity);
    this.velY = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.pierce = new Int16Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    radius: number,
    damage: number,
    pierce: number,
    gravity: number,
    kind: number,
  ): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.posX[i] = x;
    this.posY[i] = y;
    this.velX[i] = vx;
    this.velY[i] = vy;
    this.life[i] = life;
    this.radius[i] = radius;
    this.damage[i] = damage;
    this.pierce[i] = pierce;
    this.gravity[i] = gravity;
    this.spin[i] = 0;
    this.kind[i] = kind;
    return i;
  }

  /** Swap-remove i. Invalidates index i and the old last index. */
  kill(i: number): void {
    const last = --this.count;
    this.posX[i] = this.posX[last]!;
    this.posY[i] = this.posY[last]!;
    this.velX[i] = this.velX[last]!;
    this.velY[i] = this.velY[last]!;
    this.life[i] = this.life[last]!;
    this.radius[i] = this.radius[last]!;
    this.damage[i] = this.damage[last]!;
    this.pierce[i] = this.pierce[last]!;
    this.gravity[i] = this.gravity[last]!;
    this.spin[i] = this.spin[last]!;
    this.kind[i] = this.kind[last]!;
  }
}
