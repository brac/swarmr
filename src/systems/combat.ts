// Shared hit resolution: roll a weapon's base damage into an actual amount, with
// ±variance spread and a crit chance. Used by every damage source (collision for
// the Dagger, the Whip directly) so variance/crit feel is consistent.
//
// Allocation-free: returns a single reused result object. Callers must read its
// fields immediately (before the next rollHit call), which they always do.

import type { Rng } from "../core/rng";
import { COMBAT } from "../data/combat";

export interface HitRoll {
  amount: number;
  crit: boolean;
}

const result: HitRoll = { amount: 0, crit: false };

export function rollHit(rng: Rng, base: number): HitRoll {
  // Spread: base × (1 ± variance).
  let dmg = base * (1 + (rng.next() * 2 - 1) * COMBAT.damageVariance);
  const crit = rng.next() < COMBAT.critChance;
  if (crit) dmg *= COMBAT.critMultiplier;
  result.amount = Math.max(1, Math.round(dmg)); // never a 0 (or negative) hit
  result.crit = crit;
  return result;
}
