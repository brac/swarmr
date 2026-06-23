// Broadphase rebuild. Clear the spatial hash and re-insert every active enemy,
// once per tick. A full rebuild beats incremental cell-transition tracking for
// thousands of fast movers (docs/03). Wired in now — even before combat queries
// it — so its cost is on the books at the checkpoint, not a surprise later.

import type { GameState } from "../state/gameState";

export function rebuildHash(state: GameState): void {
  const e = state.enemies;
  const h = state.hash;
  h.clear();
  const n = e.count;
  for (let i = 0; i < n; i++) {
    h.insert(i, e.posX[i]!, e.posY[i]!);
  }
}
