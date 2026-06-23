// XP gem storage — same SoA-over-typed-arrays pool as the other entities. Active
// set packed in [0,count), O(1) swap-remove on pickup, zero per-frame allocation.

export class Gems {
  readonly capacity: number;
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly value: Int32Array; // XP granted on pickup

  constructor(capacity: number) {
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.value = new Int32Array(capacity);
  }

  /** Drop a gem. Returns its index, or -1 if at capacity. */
  spawn(x: number, y: number, value: number): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.posX[i] = x;
    this.posY[i] = y;
    this.value[i] = value;
    return i;
  }

  /** Swap-remove i. Invalidates index i and the old last index. */
  kill(i: number): void {
    const last = --this.count;
    this.posX[i] = this.posX[last]!;
    this.posY[i] = this.posY[last]!;
    this.value[i] = this.value[last]!;
  }
}
