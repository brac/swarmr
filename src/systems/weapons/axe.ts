// REDESIGN (side-scroller): the Cyclone spiral / 8-way ring sprays mostly into
// empty space (left/up/down) — rethink as forward-biased lobs or a downrange
// pattern. See BACKLOG.md "Side-scroller weapon redesigns".
//
// Axe — weapon four. The new system it forces: a projectile with gravity. It
// launches UP from the player with a random horizontal lean, arcs over, and falls
// off the bottom of the screen, piercing and damaging everything it crosses.
//
// It rides the existing projectile pool + collision: spawn it with a gravity term
// and PROJ_AXE kind, and movement/collision do the rest. Unaimed by design — the
// spread is the point. High pierce, so the per-enemy projectile re-hit gate (in
// collision) keeps it from dumping every pierce into one body near its apex.

import type { GameState } from "../../state/gameState";
import { AXE } from "../../data/weapons";
import { PROJ_AXE, PIERCE_INFINITE } from "../../state/projectiles";

export function updateAxe(state: GameState, dt: number): void {
  const w = state.weapons.axe;
  if (w.level < 1) return; // not acquired — doesn't throw until upgraded to level 1
  state.axeTimer -= dt;
  if (state.axeTimer > 0) return;

  // Axes throw on a fixed cadence whether or not enemies are near — they're an
  // area-denial lob, not an auto-target shot.
  const px = state.player.pos.x;
  const py = state.player.pos.y;

  // Global Damage passive folds in at the source so every axe carries it.
  const damage = w.damage * state.passives.damageMult;

  // Cyclone — no gravity; fling two big axes FORWARD (rightward) with a small fan
  // + jitter. No rotating spawner, nothing thrown behind the player.
  if (w.evolved) {
    const n = AXE.evo.count;
    const radius = AXE.radius * AXE.evo.radiusMult; // 100% bigger
    const evoDamage = damage * AXE.evo.damageMult; // hits hard enough to cleave
    const base = Math.atan2(state.player.facingY, state.player.facingX); // forward
    for (let c = 0; c < n; c++) {
      const offset = (c - (n - 1) / 2) * AXE.evo.spread;
      const a = base + offset + (state.rng.next() * 2 - 1) * AXE.evo.jitter;
      state.projectiles.spawn(
        px,
        py,
        Math.cos(a) * AXE.evo.speed,
        Math.sin(a) * AXE.evo.speed,
        AXE.lifetime,
        radius,
        evoDamage,
        PIERCE_INFINITE,
        0, // gravity off — these fly flat
        PROJ_AXE,
      );
    }
    state.axeTimer += AXE.evo.cooldown / state.passives.fireRateMult;
    return;
  }

  for (let c = 0; c < AXE.count; c++) {
    state.projectiles.spawn(
      px,
      py,
      AXE.launchSpeedX, // forward (rightward) — axes only arc downrange now
      -AXE.launchSpeedY, // small upward kick for a shallow arc
      AXE.lifetime,
      AXE.radius,
      damage,
      PIERCE_INFINITE, // carve through every enemy until off-screen
      AXE.gravity,
      PROJ_AXE,
    );
  }

  // Global Fire Rate passive shortens the effective cooldown (faster = divide).
  state.axeTimer += w.cooldown / state.passives.fireRateMult;
}
