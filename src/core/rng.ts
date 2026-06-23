// Seeded PRNG — mulberry32. Every gameplay random call goes through this.
// No bare Math.random() anywhere in gameplay: seeded runs are reproducible.

export class Rng {
  private state: number;

  constructor(seed: number) {
    // coerce to uint32
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max). */
  int(min: number, max: number): number {
    return (min + this.next() * (max - min)) | 0;
  }

  /** Reseed in place (useful for deterministic test setups). */
  reseed(seed: number): void {
    this.state = seed >>> 0;
  }
}
