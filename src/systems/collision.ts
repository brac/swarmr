// Projectile↔enemy collision via the spatial hash. For each projectile, gather
// enemies in its cell + neighbors and test circle-vs-circle. On hit: apply
// damage, spawn a damage number, decrement pierce, release when spent.
//
// Enemy deaths are deferred: a hit that drops HP to 0 marks the enemy (hp<=0)
// but it isn't swap-removed until the whole projectile pass is done. That keeps
// the hash's enemy indices valid throughout the pass — no index shifts mid-loop.

import type { GameState } from "../state/gameState";
import { ENEMY } from "../data/enemies";
import { COMBAT } from "../data/combat";
import { BOSS } from "../data/boss";
import { PIERCE_INFINITE } from "../state/projectiles";
import { rollHit } from "./combat";
import { damageBoss } from "./boss";

const candidates: number[] = []; // reused scratch — never per-query alloc

export function updateCollision(state: GameState): void {
  const proj = state.projectiles;
  const e = state.enemies;
  const b = state.boss;
  const h = state.hash;
  const now = state.time;

  // Downward so projectile swap-remove is safe.
  for (let p = proj.count - 1; p >= 0; p--) {
    const px = proj.posX[p]!;
    const py = proj.posY[p]!;
    const pr = proj.radius[p]!;

    // The boss lives outside the hash — test it directly. Gated by its own re-hit
    // cooldown so a dwelling infinite-pierce axe can't melt it in one tick.
    if (b.active && now >= b.projHitUntil) {
      const bx = b.pos.x - px;
      const by = b.pos.y - py;
      const brr = pr + BOSS.radius;
      if (bx * bx + by * by <= brr * brr) {
        damageBoss(state, proj.damage[p]!);
        b.projHitUntil = now + BOSS.rehitGap;
        if (proj.pierce[p] !== PIERCE_INFINITE && --proj.pierce[p]! <= 0) {
          proj.kill(p);
          continue; // projectile spent — next projectile
        }
      }
    }

    h.queryNeighbors(px, py, candidates);

    for (let k = 0; k < candidates.length; k++) {
      const ei = candidates[k]!;
      if (e.hp[ei]! <= 0) continue; // already killed earlier this tick
      if (now < e.projHitUntil[ei]!) continue; // hit too recently by a projectile

      const dx = e.posX[ei]! - px;
      const dy = e.posY[ei]! - py;
      const rr = pr + e.radius[ei]!;
      if (dx * dx + dy * dy > rr * rr) continue;

      // Hit: roll variance + crit, apply, flash, pop a number.
      const roll = rollHit(state.rng, proj.damage[p]!);
      e.hp[ei]! -= roll.amount;
      e.hitTimer[ei] = ENEMY.hitReactTime;
      e.projHitUntil[ei] = now + COMBAT.projectileRehitGap;
      state.damageNumbers.spawn(
        e.posX[ei]!,
        e.posY[ei]! - e.radius[ei]!,
        roll.amount,
        roll.crit ? 1 : 0,
      );

      // Infinite-pierce projectiles (axes) carve through everyone — never
      // consumed, never killed here; they end only by leaving the world.
      if (proj.pierce[p] !== PIERCE_INFINITE && --proj.pierce[p]! <= 0) {
        proj.kill(p);
        break; // this projectile is gone; stop testing it
      }
    }
  }

  // Now compact out the dead. Downward + swap-remove keeps it O(deaths). Every
  // death (from any weapon — they all funnel HP through here) drops an XP gem.
  for (let i = e.count - 1; i >= 0; i--) {
    if (e.hp[i]! <= 0) {
      state.gems.spawn(e.posX[i]!, e.posY[i]!, e.xpValue[i]!);
      state.kills++;
      e.kill(i);
    }
  }
}
