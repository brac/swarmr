// Enemy storage as a Structure-of-Arrays over typed arrays. This *is* the pool:
// capacity is pre-allocated once, the active set is packed in [0, count), and
// death is an O(1) swap-remove. Zero per-frame allocation — the swarm's whole
// performance story starts here. The spatial hash stores indices into these.

import { ENEMY } from "../data/enemies";

export class Enemies {
  readonly capacity: number;
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly hp: Float32Array;
  readonly hitTimer: Float32Array; // seconds of hit-react (flash/wobble) remaining
  readonly garlicNextHit: Float32Array; // sim-time this enemy is next eligible for garlic

  // Shared across the one enemy type for now; becomes per-entity if types diverge.
  readonly radius = ENEMY.radius;
  readonly speed = ENEMY.speed;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.hitTimer = new Float32Array(capacity);
    this.garlicNextHit = new Float32Array(capacity);
  }

  /** Activate one enemy. Returns its index, or -1 if at capacity. */
  spawn(x: number, y: number): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.posX[i] = x;
    this.posY[i] = y;
    this.hp[i] = ENEMY.hp;
    this.hitTimer[i] = 0;
    this.garlicNextHit[i] = 0; // eligible immediately on spawn
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
  }
}
