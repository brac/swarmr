// Spawn system. Ramps the swarm to the target count by emitting enemies at a
// random screen edge each tick. All randomness goes through the seeded RNG.

import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { SPAWN } from "../data/waves";

export function updateSpawn(state: GameState): void {
  const e = state.enemies;
  if (e.count >= SPAWN.targetCount) return;

  const rng = state.rng;
  for (let n = 0; n < SPAWN.perTick && e.count < SPAWN.targetCount; n++) {
    // Pick an edge, then a random point along it.
    const edge = rng.int(0, 4);
    let x: number;
    let y: number;
    switch (edge) {
      case 0: // top
        x = rng.range(0, WORLD_W);
        y = 0;
        break;
      case 1: // right
        x = WORLD_W;
        y = rng.range(0, WORLD_H);
        break;
      case 2: // bottom
        x = rng.range(0, WORLD_W);
        y = WORLD_H;
        break;
      default: // left
        x = 0;
        y = rng.range(0, WORLD_H);
        break;
    }
    e.spawn(x, y);
  }
}
