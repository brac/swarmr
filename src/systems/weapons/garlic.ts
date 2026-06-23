// Garlic — weapon three. The lesson it forces: a damage cooldown *per entity*.
// Unlike the Dagger/Whip (which fire on a global cooldown), garlic is an always-on
// aura. Every enemy inside the radius takes damage, but each enemy carries its own
// next-eligible timestamp (garlicNextHit): once hit, it can't be hit again until
// rehitCooldown has passed. That staggered per-enemy cadence — not a global pulse —
// is the DoT pattern reused by every future zone/aura/poison effect.
//
// Implementing the cooldown as an absolute sim-time stamp (vs a countdown) means no
// per-tick decrement pass over all enemies: we just compare against state.time.
//
// Like the Whip, garlic only subtracts HP; collision's end-of-tick compaction
// sweeps the dead, so this must run before collision (indices stay valid here).

import type { GameState } from "../../state/gameState";
import { GARLIC } from "../../data/weapons";
import { ENEMY } from "../../data/enemies";
import { rollHit } from "../combat";

export function updateGarlic(state: GameState): void {
  const e = state.enemies;
  if (e.count === 0) return;

  const h = state.hash;
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const now = state.time;
  const r2 = GARLIC.radius * GARLIC.radius;

  const cxLo = h.clampCX(px - GARLIC.radius);
  const cxHi = h.clampCX(px + GARLIC.radius);
  const cyLo = h.clampCY(py - GARLIC.radius);
  const cyHi = h.clampCY(py + GARLIC.radius);

  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const hitTimer = e.hitTimer;
  const nextHit = e.garlicNextHit;
  const radius = e.radius;
  const cellStart = h.cellStart;
  const items = h.items;
  const gridW = h.gridW;

  for (let gy = cyLo; gy <= cyHi; gy++) {
    const rowBase = gy * gridW;
    for (let gx = cxLo; gx <= cxHi; gx++) {
      const c = rowBase + gx;
      const end = cellStart[c + 1]!;
      for (let pp = cellStart[c]!; pp < end; pp++) {
        const j = items[pp]!;
        if (hp[j]! <= 0) continue; // already dead this tick
        if (now < nextHit[j]!) continue; // per-enemy cooldown still ticking
        const dx = posX[j]! - px;
        const dy = posY[j]! - py;
        if (dx * dx + dy * dy > r2) continue; // outside the aura

        const roll = rollHit(state.rng, GARLIC.damage);
        hp[j]! -= roll.amount;
        hitTimer[j] = ENEMY.hitReactTime;
        state.damageNumbers.spawn(
          posX[j]!,
          posY[j]! - radius,
          roll.amount,
          roll.crit ? 1 : 0,
        );
        nextHit[j] = now + GARLIC.rehitCooldown;
      }
    }
  }
}
