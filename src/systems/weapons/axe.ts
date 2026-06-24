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
  state.axeTimer -= dt;
  if (state.axeTimer > 0) return;

  // Axes throw on a fixed cadence whether or not enemies are near — they're an
  // area-denial lob, not an auto-target shot.
  const px = state.player.pos.x;
  const py = state.player.pos.y;

  // Global Damage passive folds in at the source so every axe carries it.
  const damage = w.damage * state.passives.damageMult;

  // Cyclone — no gravity; fling a ring of 8 big axes straight outward, with the
  // ring's base angle advanced each throw so the volleys trace a spiral.
  if (w.evolved) {
    const n = AXE.evo.count;
    const radius = AXE.radius * AXE.evo.radiusMult; // 100% bigger
    for (let c = 0; c < n; c++) {
      const a = state.axeSpiralAngle + (c / n) * Math.PI * 2;
      state.projectiles.spawn(
        px,
        py,
        Math.cos(a) * AXE.evo.speed,
        Math.sin(a) * AXE.evo.speed,
        AXE.lifetime,
        radius,
        damage,
        PIERCE_INFINITE,
        0, // gravity off — these fly flat
        PROJ_AXE,
      );
    }
    state.axeSpiralAngle += AXE.evo.turn;
    state.axeTimer += AXE.evo.cooldown / state.passives.fireRateMult;
    return;
  }

  for (let c = 0; c < AXE.count; c++) {
    const vx = state.rng.range(-AXE.launchSpeedX, AXE.launchSpeedX);
    state.projectiles.spawn(
      px,
      py,
      vx,
      -AXE.launchSpeedY, // launch upward
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
