// Dagger — the first weapon, and the whole combat backbone: it forces the
// projectile pool and (via collision) damage numbers into existence. Side-scroller:
// it fires straight along the player's (locked-right) facing — no auto-tracking —
// on cooldown. The base fan spreads `count` daggers symmetrically around that
// heading; the evolution (Thousand Fangs) fires a fast triple-stream row instead.
// See docs/02-dagger.md and docs/05-weapon-evolutions.md.

import type { GameState } from "../../state/gameState";
import { DAGGER } from "../../data/weapons";
import { PROJ_DAGGER } from "../../state/projectiles";

export function updateDagger(state: GameState, dt: number): void {
  const w = state.weapons.dagger;
  if (w.level < 1) return; // not yet acquired — doesn't fire until upgraded to level 1
  state.daggerTimer -= dt;
  if (state.daggerTimer > 0) return;

  const px = state.player.pos.x;
  const py = state.player.pos.y;

  // Fire along the player's heading (locked right). No targeting — it shoots
  // downrange whether or not an enemy is there.
  const base = Math.atan2(state.player.facingY, state.player.facingX);
  const dirX = Math.cos(base);
  const dirY = Math.sin(base);

  // Global Damage passive folds in at the source so every projectile carries it.
  const damage = w.damage * state.passives.damageMult;

  // Thousand Fangs — three parallel daggers along the heading, offset perpendicular
  // so they read as one fat, fast-moving row. Fired constantly with no pierce.
  if (w.evolved) {
    const speed = DAGGER.projectileSpeed * DAGGER.evo.speedMult;
    const vx = dirX * speed;
    const vy = dirY * speed;
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

  // Fan multiple daggers symmetrically around the heading.
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
