# 03 — Spatial Hash (uniform grid)

The load-bearing data structure. Built with the first enemy, never deferred. It answers "what's near point X?" in roughly O(local density) instead of scanning every entity. Targeting, collision, and enemy neighbor queries all go through it.

## Why uniform grid, not quadtree

For a swarm of roughly uniform density (which is exactly VS), a flat uniform grid beats a quadtree: no tree rebalancing, cache-friendly, trivial to clear and refill each tick. Quadtrees win for wildly non-uniform distributions, which this isn't.

## Cell size

Set cell size to roughly the largest common query radius (≈ enemy diameter, or projectile+enemy radius). Too small = entities span many cells and you over-check; too large = each cell holds too many entities and you lose the benefit. Make it a tunable and profile. A good starting point: 2× the enemy collision radius.

## Lifecycle each tick

1. **Clear** the grid (don't reallocate — reuse the arrays).
2. **Insert** every active enemy into its cell.
3. **Query** during targeting and collision: gather the entity's cell + the 8 neighbors, test against that candidate set only.

Rebuild fresh each tick rather than incrementally updating on movement — for thousands of fast-moving entities, full rebuild is simpler and usually faster than tracking cell transitions.

## Reference shape

```ts
export class SpatialHash {
  private cells: Map<number, number[]> = new Map(); // cellKey -> entity indices
  constructor(public cellSize: number, public worldW: number, public worldH: number) {}

  private key(cx: number, cy: number): number {
    // pack two ints into one number key
    return cx * 73856093 ^ cy * 19349663;
  }

  clear() {
    // reuse arrays: clear contents, keep the Map entries to avoid realloc churn
    for (const arr of this.cells.values()) arr.length = 0;
  }

  insert(entityIndex: number, x: number, y: number) {
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    const k = this.key(cx, cy);
    let arr = this.cells.get(k);
    if (!arr) { arr = []; this.cells.set(k, arr); }
    arr.push(entityIndex);
  }

  // collect entity indices in the 3x3 block of cells around (x, y)
  queryNeighbors(x: number, y: number, out: number[]): number[] {
    out.length = 0;
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = this.cells.get(this.key(cx + dx, cy + dy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }
}
```

Notes:
- `out` is a reused scratch array passed in by the caller — don't allocate a result array per query (that's per-frame garbage).
- Store entity **indices** into a flat enemy array, not enemy objects, to stay cache-friendly and avoid pointer chasing.
- The 3×3 neighbor query assumes query radius ≤ cell size. If a weapon's radius exceeds the cell size, widen the loop bounds accordingly (or just size cells to the largest radius).

## Profiling check

At 2,000 enemies, clear+insert+all queries for one tick should sit comfortably inside the 4ms logic budget. If it doesn't, your cell size is wrong before your algorithm is.
