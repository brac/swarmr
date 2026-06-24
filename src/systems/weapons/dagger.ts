// Dagger — the first weapon, and the whole combat backbone: it forces the
// projectile pool, the spatial-hash targeting query, and (via collision) damage
// numbers into existence. Auto-fires on cooldown at the nearest enemy. When
// upgraded to fire multiple, they fan out around the aim. See docs/02-dagger.md.

import type { GameState } from "../../state/gameState";
import { DAGGER } from "../../data/weapons";
import { PROJ_DAGGER } from "../../state/projectiles";
import { nearestEnemy } from "../targeting";

export function updateDagger(state: GameState, dt: number): void {
  const w = state.weapons.dagger;
  state.daggerTimer -= dt;
  if (state.daggerTimer > 0) return;

  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const target = nearestEnemy(state, px, py);
  if (target === -1) {
    // No target yet — hold the timer at 0 so we fire the instant one appears
    // (rather than letting it run negative and burst-fire on arrival).
    state.daggerTimer = 0;
    return;
  }

  const e = state.enemies;
  const dx = e.posX[target]! - px;
  const dy = e.posY[target]! - py;
  const base = Math.atan2(dy, dx);

  // Global Damage passive folds in at the source so every projectile carries it.
  const damage = w.damage * state.passives.damageMult;

  // Fan multiple daggers symmetrically around the aim.
  for (let c = 0; c < w.count; c++) {
    const angle = base + (c - (w.count - 1) / 2) * DAGGER.spread;
    state.projectiles.spawn(
      px,
      py,
      Math.cos(angle) * DAGGER.projectileSpeed,
      Math.sin(angle) * DAGGER.projectileSpeed,
      DAGGER.projectileLifetime,
      DAGGER.projectileRadius,
      damage,
      DAGGER.pierce,
      0, // no gravity — straight-line
      PROJ_DAGGER,
    );
  }

  // Global Fire Rate passive shortens the effective cooldown (faster = divide).
  state.daggerTimer += w.cooldown / state.passives.fireRateMult;
}
