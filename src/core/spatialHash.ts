// Uniform-grid spatial hash — the load-bearing broadphase. Answers "what's near
// point X?" in ~O(local density). Targeting, collision, and neighbor queries all
// go through it. Rebuilt fresh each tick (clear → insert all → query); for
// thousands of fast movers a full rebuild beats tracking cell transitions.
//
// Stores entity *indices* into flat arrays, not objects, to stay cache-friendly.
// Present from Phase 0 so the architecture is shaped correctly; gameplay wires
// it up in Phase 1.

export class SpatialHash {
  // cellKey -> entity indices. Arrays are reused across ticks (cleared, not freed).
  private cells = new Map<number, number[]>();

  constructor(public cellSize: number) {}

  private key(cx: number, cy: number): number {
    // pack two cell coords into one number key
    return (cx * 73856093) ^ (cy * 19349663);
  }

  /** Empty every cell's array but keep the Map entries to avoid realloc churn. */
  clear(): void {
    for (const arr of this.cells.values()) arr.length = 0;
  }

  insert(entityIndex: number, x: number, y: number): void {
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    const k = this.key(cx, cy);
    let arr = this.cells.get(k);
    if (arr === undefined) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push(entityIndex);
  }

  /**
   * Collect entity indices in the 3x3 block of cells around (x, y) into `out`.
   * `out` is a caller-owned scratch array — never allocate a result per query.
   * Assumes query radius <= cellSize; widen the loop if a radius exceeds it.
   */
  queryNeighbors(x: number, y: number, out: number[]): number[] {
    out.length = 0;
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = this.cells.get(this.key(cx + dx, cy + dy));
        if (arr !== undefined) {
          for (let i = 0; i < arr.length; i++) out.push(arr[i]!);
        }
      }
    }
    return out;
  }
}
