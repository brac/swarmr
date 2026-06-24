// Garlic tendril visuals — pooled SoA, same pattern as whip strikes. Black Aura
// (evolved garlic) flicks a short tendril from the player to each enemy it damages;
// this holds only the lingering *visual* (a line + a fade), data here, pixels in
// the renderer. Fade is keyed off sim-time (`born`) to match garlic's stamp-based
// cadence — garlic gets no dt, so we never decrement an age here.

export const TENDRIL_CAPACITY = 64; // cap per-frame; extra hits skip a tendril

export class Tendrils {
  readonly capacity: number;
  count = 0;

  readonly ox: Float32Array; // player end
  readonly oy: Float32Array;
  readonly angle: Float32Array; // heading toward the struck enemy (rad)
  readonly len: Float32Array; // player→enemy distance (px)
  readonly born: Float32Array; // sim-time the tendril was spawned

  constructor(capacity: number) {
    this.capacity = capacity;
    this.ox = new Float32Array(capacity);
    this.oy = new Float32Array(capacity);
    this.angle = new Float32Array(capacity);
    this.len = new Float32Array(capacity);
    this.born = new Float32Array(capacity);
  }

  spawn(ox: number, oy: number, angle: number, len: number, now: number): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.ox[i] = ox;
    this.oy[i] = oy;
    this.angle[i] = angle;
    this.len[i] = len;
    this.born[i] = now;
    return i;
  }

  /** Swap-remove i. Invalidates index i and the old last index. */
  kill(i: number): void {
    const last = --this.count;
    this.ox[i] = this.ox[last]!;
    this.oy[i] = this.oy[last]!;
    this.angle[i] = this.angle[last]!;
    this.len[i] = this.len[last]!;
    this.born[i] = this.born[last]!;
  }
}
