// Laser — weapon five, a Cyclops-style sustained beam. The new shape it forces: a
// line-segment hitbox. The Dagger pool throws movers, the Whip cuts a wedge, Garlic
// pulses a disc — the Laser sweeps a long thin rectangle from the player along their
// facing heading, piercing every body on the line at once. It's continuous like Garlic
// (ON for LASER.duration once triggered), so it carries the same per-enemy re-hit gate
// (laserNextHit) instead of dumping a hit every 240Hz frame. The heading is locked from
// the player's facing at trigger time, so a blast reads as one deliberate beam rather
// than a beam that wobbles with every input.
//
// Like the Whip/Garlic it only subtracts HP; collision's end-of-tick compaction sweeps
// the dead and drops gems, so this must run before collision (indices stay valid here).

import type { GameState } from "../../state/gameState";
import { LASER } from "../../data/weapons";
import { ENEMY } from "../../data/enemies";
import { BOSS } from "../../data/boss";
import { rollHit } from "../combat";
import { damageBoss } from "../boss";

export function updateLaser(state: GameState, dt: number): void {
  state.laserTimer -= dt;

  // Trigger a fresh blast when the cooldown elapses and one isn't already firing.
  // Lock the beam's heading to the player's facing at this instant.
  if (state.laserActive <= 0 && state.laserTimer <= 0) {
    state.laserActive = LASER.duration;
    state.laserTimer +=
      state.weapons.laser.cooldown / state.passives.fireRateMult;
    state.laserDirX = state.player.facingX;
    state.laserDirY = state.player.facingY;
  }

  if (state.laserActive <= 0) return; // beam off this tick
  state.laserActive -= dt;

  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const ux = state.laserDirX;
  const uy = state.laserDirY;
  const range = LASER.range;
  const halfW = LASER.width * 0.5;
  const now = state.time;
  // Global Damage passive folds into the per-tick damage, like the other weapons.
  const damage = state.weapons.laser.damage * state.passives.damageMult;

  // One O(n) pass over the active swarm. A screen-spanning beam's bounding box covers
  // most of the grid anyway, so walking hash cells (as the localized Whip/Garlic do)
  // buys nothing here — a single linear scan with the cheap project-onto-axis test is
  // simpler and still O(n), not O(n²). Allocation-free: all hoisted scalars/arrays.
  const e = state.enemies;
  const n = e.count;
  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const radius = e.radius;
  const hitTimer = e.hitTimer;
  const nextHit = e.laserNextHit;

  for (let i = 0; i < n; i++) {
    if (hp[i]! <= 0) continue; // already dead this tick
    if (now < nextHit[i]!) continue; // re-hit cooldown still ticking
    const rx = posX[i]! - px;
    const ry = posY[i]! - py;
    const er = radius[i]!;
    // Distance along the beam axis; reject behind the muzzle or past the reach.
    const t = rx * ux + ry * uy;
    if (t < -er || t > range + er) continue;
    // Perpendicular distance to the beam line (|cross|, since the axis is unit length).
    const perp = rx * uy - ry * ux;
    const lim = halfW + er;
    if (perp > lim || perp < -lim) continue;

    const roll = rollHit(state.rng, damage);
    hp[i]! -= roll.amount;
    hitTimer[i] = ENEMY.hitReactTime;
    nextHit[i] = now + LASER.rehitCooldown;
    state.damageNumbers.spawn(
      posX[i]!,
      posY[i]! - er,
      roll.amount,
      roll.crit ? 1 : 0,
    );
  }

  // Boss (outside the hash): same axis/perp test, gated by its own re-hit cooldown.
  const b = state.boss;
  if (b.active && now >= b.laserNextHit) {
    const rx = b.pos.x - px;
    const ry = b.pos.y - py;
    const t = rx * ux + ry * uy;
    if (t >= -BOSS.radius && t <= range + BOSS.radius) {
      const perp = rx * uy - ry * ux;
      const lim = halfW + BOSS.radius;
      if (perp <= lim && perp >= -lim) {
        damageBoss(state, damage);
        b.laserNextHit = now + BOSS.laserCooldown;
      }
    }
  }
}
