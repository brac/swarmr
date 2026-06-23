// Projectile↔enemy collision via the spatial hash. For each projectile, gather
// enemies in its cell + neighbors and test circle-vs-circle. On hit: apply
// damage, spawn a damage number, decrement pierce, release when spent.
//
// Enemy deaths are deferred: a hit that drops HP to 0 marks the enemy (hp<=0)
// but it isn't swap-removed until the whole projectile pass is done. That keeps
// the hash's enemy indices valid throughout the pass — no index shifts mid-loop.

import type { GameState } from "../state/gameState";

const candidates: number[] = []; // reused scratch — never per-query alloc

export function updateCollision(state: GameState): void {
  const proj = state.projectiles;
  const e = state.enemies;
  const h = state.hash;

  // Downward so projectile swap-remove is safe.
  for (let p = proj.count - 1; p >= 0; p--) {
    const px = proj.posX[p]!;
    const py = proj.posY[p]!;
    const pr = proj.radius[p]!;

    h.queryNeighbors(px, py, candidates);

    for (let k = 0; k < candidates.length; k++) {
      const ei = candidates[k]!;
      if (e.hp[ei]! <= 0) continue; // already killed earlier this tick

      const dx = e.posX[ei]! - px;
      const dy = e.posY[ei]! - py;
      const rr = pr + e.radius;
      if (dx * dx + dy * dy > rr * rr) continue;

      // Hit.
      const dmg = proj.damage[p]!;
      e.hp[ei]! -= dmg;
      state.damageNumbers.spawn(e.posX[ei]!, e.posY[ei]! - e.radius, dmg);

      if (--proj.pierce[p]! <= 0) {
        proj.kill(p);
        break; // this projectile is gone; stop testing it
      }
    }
  }

  // Now compact out the dead. Downward + swap-remove keeps it O(deaths).
  for (let i = e.count - 1; i >= 0; i--) {
    if (e.hp[i]! <= 0) e.kill(i);
  }
}
