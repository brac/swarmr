// XP gems: home toward the player when in magnet range, grant XP on pickup, and
// drive leveling. Gems only ever interact with the player (a single point), so
// no spatial hash is needed — a flat pass over the pool is plenty.

import type { GameState } from "../state/gameState";
import { XP, LEVEL, xpToNext } from "../data/xp";

export function updateGems(state: GameState, dt: number): void {
  const g = state.gems;
  const p = state.player;
  const px = p.pos.x;
  const py = p.pos.y;
  const pickup2 = p.pickupRadius * p.pickupRadius;
  const magnet2 = p.magnetRadius * p.magnetRadius;
  const step = XP.magnetSpeed * dt;

  // Downward so swap-remove (kill) doesn't skip the swapped-in gem.
  for (let i = g.count - 1; i >= 0; i--) {
    const dx = px - g.posX[i]!;
    const dy = py - g.posY[i]!;
    const d2 = dx * dx + dy * dy;

    if (d2 <= pickup2) {
      addXp(state, g.value[i]!);
      g.kill(i);
      continue;
    }
    if (d2 <= magnet2) {
      const inv = 1 / Math.sqrt(d2);
      g.posX[i]! += dx * inv * step;
      g.posY[i]! += dy * inv * step;
    }
  }
}

// Add XP and resolve any level-ups (carrying overflow). Each level heals a bit
// and fires the level-up flash; the upgrade picker lands on top of this later.
function addXp(state: GameState, amount: number): void {
  const p = state.player;
  p.xp += amount;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = xpToNext(p.level);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * LEVEL.upHeal);
    state.levelUpTimer = LEVEL.upFlashTime;
  }
}
