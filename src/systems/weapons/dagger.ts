// Dagger — the first weapon, and the whole combat backbone: it forces the
// projectile pool, the spatial-hash targeting query, and (via collision) damage
// numbers into existence. Auto-fires on cooldown at the nearest enemy. When
// upgraded to fire multiple, they fan out around the aim. See docs/02-dagger.md.
// Its evolution (Thousand Fangs) trades auto-aim for a rapid forward stream;
// see docs/05-weapon-evolutions.md.

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

  // Thousand Fangs — three parallel daggers along the player's heading, offset
  // perpendicular to it so they read as one fat, fast-moving row. Fired constantly
  // with no targeting and no pierce (each stops at its first hit).
  if (w.evolved) {
    const angle = Math.atan2(state.player.facingY, state.player.facingX);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const speed = DAGGER.projectileSpeed * DAGGER.evo.speedMult;
    const vx = dirX * speed;
    const vy = dirY * speed;
    // Perpendicular to the heading (−dirY, dirX) spaces the streams sideways.
    const damage = w.damage * state.passives.damageMult;
    const streams = DAGGER.evo.streams;
    for (let c = 0; c < streams; c++) {
      const off = (c - (streams - 1) / 2) * DAGGER.evo.rowSpacing;
      state.projectiles.spawn(
        px - dirY * off,
        py + dirX * off,
        vx,
        vy,
        DAGGER.projectileLifetime,
        DAGGER.projectileRadius,
        damage,
        0, // no pierce
        0, // no gravity — straight-line
        PROJ_DAGGER,
      );
    }
    state.daggerTimer += DAGGER.evo.cooldown / state.passives.fireRateMult;
    return;
  }

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
