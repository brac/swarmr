// Dagger — the first weapon, and the whole combat backbone: it forces the
// projectile pool, the spatial-hash targeting query, and (via collision) damage
// numbers into existence. Auto-fires on cooldown at the nearest enemy.
// See docs/02-dagger.md.

import type { GameState } from "../../state/gameState";
import { DAGGER } from "../../data/weapons";
import { PROJ_DAGGER } from "../../state/projectiles";
import { nearestEnemy } from "../targeting";

export function updateDagger(state: GameState, dt: number): void {
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
  const inv = 1 / Math.sqrt(dx * dx + dy * dy || 1);
  const vx = dx * inv * DAGGER.projectileSpeed;
  const vy = dy * inv * DAGGER.projectileSpeed;

  for (let c = 0; c < DAGGER.count; c++) {
    state.projectiles.spawn(
      px,
      py,
      vx,
      vy,
      DAGGER.projectileLifetime,
      DAGGER.projectileRadius,
      DAGGER.damage,
      DAGGER.pierce,
      0, // no gravity — straight-line
      PROJ_DAGGER,
    );
  }

  state.daggerTimer += DAGGER.cooldown;
}
