// Enemy storage as a Structure-of-Arrays over typed arrays. This *is* the pool:
// capacity is pre-allocated once, the active set is packed in [0, count), and
// death is an O(1) swap-remove. Zero per-frame allocation — the swarm's whole
// performance story starts here. The spatial hash stores indices into these.
//
// Stats are per-enemy (denormalized from the type at spawn) so variety costs the
// hot loops nothing beyond an extra array read.

import { ENEMY_TYPES } from "../data/enemies";

export class Enemies {
  readonly capacity: number;
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly hp: Float32Array;
  readonly hitTimer: Float32Array; // seconds of hit-react (flash/wobble) remaining
  readonly garlicNextHit: Float32Array; // sim-time this enemy is next eligible for garlic
  readonly projHitUntil: Float32Array; // sim-time before which a projectile won't re-hit it
  readonly laserNextHit: Float32Array; // sim-time this enemy is next eligible for a laser tick

  // Per-enemy stats, set from the type on spawn.
  readonly speed: Float32Array;
  readonly radius: Float32Array;
  readonly contactDamage: Float32Array;
  readonly color: Uint32Array; // base tint (0xRRGGBB)
  readonly xpValue: Int32Array; // XP dropped on death
  readonly type: Uint8Array; // ENEMY_TYPES index

  constructor(capacity: number) {
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.hitTimer = new Float32Array(capacity);
    this.garlicNextHit = new Float32Array(capacity);
    this.projHitUntil = new Float32Array(capacity);
    this.laserNextHit = new Float32Array(capacity);
    this.speed = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.contactDamage = new Float32Array(capacity);
    this.color = new Uint32Array(capacity);
    this.xpValue = new Int32Array(capacity);
    this.type = new Uint8Array(capacity);
  }

  /**
   * Activate one enemy of `type`, with its base HP scaled by `hpScale` (the
   * difficulty ramp). Returns its index, or -1 if at capacity.
   */
  spawn(x: number, y: number, type: number, hpScale: number): number {
    if (this.count >= this.capacity) return -1;
    const t = ENEMY_TYPES[type]!;
    const i = this.count++;
    this.posX[i] = x;
    this.posY[i] = y;
    this.hp[i] = t.hp * hpScale;
    this.hitTimer[i] = 0;
    this.garlicNextHit[i] = 0; // eligible immediately on spawn
    this.projHitUntil[i] = 0;
    this.laserNextHit[i] = 0;
    this.speed[i] = t.speed;
    this.radius[i] = t.radius;
    this.contactDamage[i] = t.contactDamage;
    this.color[i] = t.color;
    this.xpValue[i] = t.xp;
    this.type[i] = type;
    return i;
  }

  /**
   * Remove enemy i by swapping the last active enemy into its slot. O(1), keeps
   * the active set packed. NOTE: this invalidates index i (now holds a different
   * enemy) and the old last index — callers iterating must account for it.
   */
  kill(i: number): void {
    const last = --this.count;
    this.posX[i] = this.posX[last]!;
    this.posY[i] = this.posY[last]!;
    this.hp[i] = this.hp[last]!;
    this.hitTimer[i] = this.hitTimer[last]!;
    this.garlicNextHit[i] = this.garlicNextHit[last]!;
    this.projHitUntil[i] = this.projHitUntil[last]!;
    this.laserNextHit[i] = this.laserNextHit[last]!;
    this.speed[i] = this.speed[last]!;
    this.radius[i] = this.radius[last]!;
    this.contactDamage[i] = this.contactDamage[last]!;
    this.color[i] = this.color[last]!;
    this.xpValue[i] = this.xpValue[last]!;
    this.type[i] = this.type[last]!;
  }
}
