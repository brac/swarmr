// Broadphase rebuild. Counting-sort every active enemy into the grid, once per
// tick. A full rebuild beats incremental cell-transition tracking for thousands
// of fast movers (docs/03), and the flat-grid build is allocation-free.

import type { GameState } from "../state/gameState";

export function rebuildHash(state: GameState): void {
  const e = state.enemies;
  state.hash.build(e.posX, e.posY, e.count);
}
