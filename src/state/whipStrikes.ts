// Whip-strike visuals — pooled SoA, same pattern as the other entity stores.
// The damage is instantaneous (applied the tick the whip swings); this holds only
// the lingering *visual* of a swing so the renderer can fade it out. Data here,
// pixels in the renderer — the view stays dumb.

export const WHIP_STRIKE_CAPACITY = 16; // far more than ever active at once

export class WhipStrikes {
  readonly capacity: number;
  count = 0;

  readonly posX: Float32Array; // swing origin (player pos at the moment of the swing)
  readonly posY: Float32Array;
  readonly angle: Float32Array; // aim direction (rad)
  readonly age: Float32Array; // seconds since the swing

  constructor(capacity: number) {
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.angle = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
  }

  spawn(x: number, y: number, angle: number): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.posX[i] = x;
    this.posY[i] = y;
    this.angle[i] = angle;
    this.age[i] = 0;
    return i;
  }

  /** Swap-remove i. Invalidates index i and the old last index. */
  kill(i: number): void {
    const last = --this.count;
    this.posX[i] = this.posX[last]!;
    this.posY[i] = this.posY[last]!;
    this.angle[i] = this.angle[last]!;
    this.age[i] = this.age[last]!;
  }
}
