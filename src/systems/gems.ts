// Gems: sparse, valuable ground drops. They drift left with the world (like an
// item the side-scrolling player passes), home to the player once in magnet
// range, and each one collected grants a single upgrade. Gems only ever interact
// with the player (a single point), so no spatial hash is needed.

import type { GameState } from "../state/gameState";
import { XP, LEVEL } from "../data/xp";

// Off the left edge → the player scrolled past it; despawn (a missed upgrade).
const GEM_CULL_LEFT = -60;

export function updateGems(state: GameState, dt: number): void {
  const g = state.gems;
  const p = state.player;
  const px = p.pos.x;
  const py = p.pos.y;
  const pickup2 = p.pickupRadius * p.pickupRadius;
  const magnet2 = p.magnetRadius * p.magnetRadius;
  const step = XP.magnetSpeed * dt;
  const drift = XP.driftSpeed * dt;

  // Downward so swap-remove (kill) doesn't skip the swapped-in gem.
  for (let i = g.count - 1; i >= 0; i--) {
    const dx = px - g.posX[i]!;
    const dy = py - g.posY[i]!;
    const d2 = dx * dx + dy * dy;

    if (d2 <= pickup2) {
      collectGem(state);
      g.kill(i);
      continue;
    }
    if (d2 <= magnet2) {
      // Close enough — snap toward the player (overrides the drift).
      const inv = 1 / Math.sqrt(d2);
      g.posX[i]! += dx * inv * step;
      g.posY[i]! += dy * inv * step;
    } else {
      // Otherwise it lies on the ground and the world scrolls left past it.
      g.posX[i]! -= drift;
      if (g.posX[i]! < GEM_CULL_LEFT) g.kill(i);
    }
  }
}

// Collect one gem: it counts toward the run total (HUD bar + pickup SFX) and
// grants a single upgrade. The debug leveling toggle freezes the upgrade grant.
function collectGem(state: GameState): void {
  state.player.xp++; // gems-collected counter
  if (state.levelingEnabled) levelUp(state);
}

// One upgrade grant: bump the level counter, queue an upgrade choice (pausing the
// sim), and fire the flash. Also the debug "+level" path.
export function levelUp(state: GameState): void {
  state.player.level++;
  state.levelUpsPending++;
  state.levelUpTimer = LEVEL.upFlashTime;
}

// Debug "-level": step the level counter back (never below 1). Can't un-apply an
// already-chosen upgrade — it only adjusts the bookkeeping.
export function levelDown(state: GameState): void {
  const p = state.player;
  if (p.level <= 1) return;
  p.level--;
}
