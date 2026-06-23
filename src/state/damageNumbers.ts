// Damage-number state — pooled SoA. The visual (pooled BitmapText) lives in the
// renderer; this holds only the data so the view stays dumb and rebuildable.

export const DAMAGE_NUMBER_CAPACITY = 256;
export const DN_TTL = 0.6; // lifetime (s)
export const DN_RISE = 70; // upward drift (px/sec)

export class DamageNumbers {
  readonly capacity: number;
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly value: Int32Array;
  readonly age: Float32Array; // seconds since spawn

  constructor(capacity: number) {
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.value = new Int32Array(capacity);
    this.age = new Float32Array(capacity);
  }

  spawn(x: number, y: number, value: number): number {
    // Oldest-drops behavior if we ever flood: just bail when full.
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.posX[i] = x;
    this.posY[i] = y;
    this.value[i] = value;
    this.age[i] = 0;
    return i;
  }

  /** Swap-remove i. Invalidates index i and the old last index. */
  kill(i: number): void {
    const last = --this.count;
    this.posX[i] = this.posX[last]!;
    this.posY[i] = this.posY[last]!;
    this.value[i] = this.value[last]!;
    this.age[i] = this.age[last]!;
  }
}
