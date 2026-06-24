// Spawn system. Ramps the swarm to the target count by emitting enemies at a
// random screen edge each tick. The enemy *type* and an HP scale are chosen from
// the difficulty curve (which keys off elapsed sim time), so the run gets harder:
// tougher types phase in and every enemy gets beefier. All randomness is seeded.

import type { GameState } from "../state/gameState";
import type { Rng } from "../core/rng";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { SPAWN, RAMP, DIFFICULTY } from "../data/waves";

export function updateSpawn(state: GameState): void {
  const e = state.enemies;
  const time = state.time;

  // Current swarm cap: ease-IN ramp from startCount → rampToCount over rampSeconds,
  // then held. We square the 0..1 progress (`tn*tn`) so the opening minutes stay
  // gentle and the crowd only piles on in the back half — a plain linear ramp added
  // the same count every second, which buried the player before they could dig in.
  // `| 0` floors to an integer count; plain arithmetic keeps this hot path clean.
  const tn0 = time >= RAMP.rampSeconds ? 1 : time / RAMP.rampSeconds; // 0..1 progress
  const tn = tn0 * tn0; // quadratic ease-in
  const target =
    (RAMP.startCount + (RAMP.rampToCount - RAMP.startCount) * tn) | 0;
  if (e.count >= target) return;

  const rng = state.rng;
  const hpScale = 1 + (time / 60) * DIFFICULTY.hpRampPerMin;

  for (let n = 0; n < SPAWN.perTick && e.count < target; n++) {
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
    e.spawn(x, y, pickType(rng, time), hpScale);
  }
}

// Weighted-random enemy type from the latest difficulty tier reached. Index loops
// only — runs up to perTick× per tick, so it stays allocation-free.
function pickType(rng: Rng, time: number): number {
  const tiers = DIFFICULTY.tiers;
  let w: readonly number[] = tiers[0]!.w;
  for (let i = 1; i < tiers.length; i++) {
    if (time >= tiers[i]!.t) w = tiers[i]!.w;
    else break;
  }

  let total = 0;
  for (let i = 0; i < w.length; i++) total += w[i]!;
  let r = rng.next() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i]!;
    if (r <= 0) return i;
  }
  return 0;
}
