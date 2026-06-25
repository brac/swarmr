// Whip — now a melee SWORD. The lesson it still forces: a non-projectile, area-
// overlap damage source. Unlike the old auto-swing whip, the sword only activates
// when an enemy is within striking range (`state.swordActive`, which the renderer
// reads to swing the blade sprite). While active and off cooldown it cleaves every
// enemy in a forward arc around the player in one instantaneous tick.
//
// Death handling is outsourced: the sword only subtracts HP. Collision's end-of-tick
// compaction sweeps every hp<=0 enemy, so the sword MUST run before collision (the
// hash indices it reads are all still valid — nothing has been swap-removed yet).

import type { GameState } from "../../state/gameState";
import { WHIP } from "../../data/weapons";
import { ENEMY } from "../../data/enemies";
import { BOSS } from "../../data/boss";
import { nearestEnemy } from "../targeting";
import { rollHit } from "../combat";
import { damageBoss } from "../boss";

export function updateWhip(state: GameState, dt: number): void {
  state.swordActive = false; // default; set true below if a target is in range
  const wstat = state.weapons.whip;
  if (wstat.level < 1) return; // not acquired

  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const evolved = wstat.evolved;
  const range = evolved ? WHIP.evo.range : WHIP.range;

  // The sword swings only when the nearest enemy is within striking range.
  const e = state.enemies;
  const target = nearestEnemy(state, px, py);
  let inRange = false;
  if (target !== -1) {
    const dx = e.posX[target]! - px;
    const dy = e.posY[target]! - py;
    inRange = dx * dx + dy * dy <= range * range;
  }
  // The boss can also keep the blade swinging even when the swarm is clear.
  const b = state.boss;
  if (!inRange && b.active) {
    const dx = b.pos.x - px;
    const dy = b.pos.y - py;
    const reach = range + BOSS.radius;
    inRange = dx * dx + dy * dy <= reach * reach;
  }
  state.swordActive = inRange;

  // Cool down toward ready, but never below 0 — otherwise the timer accumulates a
  // large negative value while no mob is in range and, on first contact, fires a
  // burst of swings (one per tick) that deletes the mob instantly.
  state.whipTimer -= dt;
  if (state.whipTimer < 0) state.whipTimer = 0;
  if (!inRange || state.whipTimer > 0) return; // not ready / nothing to hit

  // Global Damage passive folds into the swing once, up front.
  const damage = wstat.damage * state.passives.damageMult;

  // Damage everyone in the forward arc: within `range`, ahead of the player
  // (dx >= -back), and within ±arcHalfAngle of straight forward (+x). The arc test
  // is a dot product vs cos(halfAngle) — no atan2 per enemy. Walk the hash cells
  // covering the strike box.
  const range2 = range * range;
  const cosHalf = Math.cos(WHIP.arcHalfAngle);
  const h = state.hash;
  const cxLo = h.clampCX(px - WHIP.back);
  const cxHi = h.clampCX(px + range);
  const cyLo = h.clampCY(py - range);
  const cyHi = h.clampCY(py + range);

  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const hitTimer = e.hitTimer;
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
        const dx = posX[j]! - px;
        const dy = posY[j]! - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > range2 || d2 < 1e-6) continue;
        if (dx < -WHIP.back) continue; // behind the player
        // Forward arc: cos of the angle between +x and the enemy ≥ cos(half).
        const invd = 1 / Math.sqrt(d2);
        if (dx * invd < cosHalf) continue;

        const roll = rollHit(state.rng, damage);
        hp[j]! -= roll.amount;
        hitTimer[j] = ENEMY.hitReactTime;
        state.damageNumbers.spawn(posX[j]!, posY[j]! - radius[j]!, roll.amount, roll.crit ? 1 : 0);
      }
    }
  }

  // Boss (outside the hash): one hit per swing if it's inside the arc.
  if (b.active) {
    const dx = b.pos.x - px;
    const dy = b.pos.y - py;
    const bd2 = dx * dx + dy * dy;
    const reach = range + BOSS.radius;
    if (bd2 > 1e-6 && bd2 <= reach * reach && dx >= -WHIP.back) {
      if (dx / Math.sqrt(bd2) >= cosHalf) damageBoss(state, damage);
    }
  }

  // Kick off the swing animation: stamp the start and flip the sweep direction so
  // the blade alternates (a true back-and-forth). The renderer sweeps one arc over
  // the cooldown, so the visible swing exactly matches this firing cadence.
  state.swordSwingStart = state.time;
  state.swordSwingDir = !state.swordSwingDir;

  // Global Fire Rate passive shortens the effective cooldown (faster = divide).
  // Absolute assignment (not +=) so an already-zeroed timer can't bank extra swings.
  const cooldown = evolved ? WHIP.evo.cooldown : wstat.cooldown;
  state.whipTimer = cooldown / state.passives.fireRateMult;
}
