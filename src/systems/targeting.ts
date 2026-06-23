// Shared auto-target query: nearest active enemy to a point, via the spatial
// hash. Both the Dagger (single shot) and the Whip (arc center) aim with it.

import type { GameState } from "../state/gameState";

// Reused scratch for ring queries — not gameplay state, never per-call alloc.
const ring: number[] = [];

// Cap the outward search so an empty grid can't make us scan forever. The world
// is ~80x45 cells; this comfortably covers it.
const MAX_RING = 96;

/**
 * Nearest active enemy to (x, y): scan the hash outward ring by ring, and once a
 * candidate is found check one extra ring (a closer enemy can sit in an adjacent
 * cell) before stopping. Returns the enemy index, or -1 if none.
 */
export function nearestEnemy(state: GameState, x: number, y: number): number {
  const e = state.enemies;
  if (e.count === 0) return -1;
  const h = state.hash;
  const cx = h.clampCX(x);
  const cy = h.clampCY(y);

  let best = -1;
  let bestD2 = Infinity;
  let foundRing = -1;

  for (let r = 0; r <= MAX_RING; r++) {
    h.queryRing(cx, cy, r, ring);
    for (let k = 0; k < ring.length; k++) {
      const idx = ring[k]!;
      const dx = e.posX[idx]! - x;
      const dy = e.posY[idx]! - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = idx;
      }
    }
    if (best !== -1) {
      if (foundRing === -1) foundRing = r;
      // One ring past the first hit, then stop — bounds the search to local density.
      if (r >= foundRing + 1) break;
    }
  }
  return best;
}
