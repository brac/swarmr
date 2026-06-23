// Dagger — the first weapon, and the whole combat backbone: it forces the
// projectile pool, the spatial-hash targeting query, and (via collision) damage
// numbers into existence. Auto-fires on cooldown at the nearest enemy.
// See docs/02-dagger.md.

import type { GameState } from "../../state/gameState";
import { DAGGER } from "../../data/weapons";

// Reused scratch buffer for ring queries — not gameplay state, never per-call alloc.
const ring: number[] = [];

// Cap the outward search so an empty grid can't make us scan forever. The world
// is ~80x45 cells; this comfortably covers it.
const MAX_RING = 96;

/**
 * Nearest active enemy to (x, y) via the spatial hash: scan outward ring by ring,
 * and once a candidate is found, check one extra ring (a closer enemy can sit in
 * an adjacent cell) before stopping. Returns the enemy index, or -1 if none.
 */
function nearestEnemy(state: GameState, x: number, y: number): number {
  const e = state.enemies;
  if (e.count === 0) return -1;
  const h = state.hash;
  const cx = h.clampCX(x);
  const cy = h.clampCY(y);

  let best = -1;
  let bestD2 = Infinity;
  let foundRing = -1;

  for (let r = 0; r <= MAX_RING; r++) {
    h.queryRing(cx, cy, r, ring);
    for (let k = 0; k < ring.length; k++) {
      const idx = ring[k]!;
      const dx = e.posX[idx]! - x;
      const dy = e.posY[idx]! - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = idx;
      }
    }
    if (best !== -1) {
      if (foundRing === -1) foundRing = r;
      // One ring past the first hit, then stop — bounds the search to local density.
      if (r >= foundRing + 1) break;
    }
  }
  return best;
}

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
    );
  }

  state.daggerTimer += DAGGER.cooldown;
}
