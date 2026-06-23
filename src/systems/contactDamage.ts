// Contact damage: enemies touching the player hurt it. To avoid being melted
// instantly by a wall of overlapping bodies, a hit opens an i-frame window
// (PLAYER.invulnTime) during which no further contact registers — one hit per
// window regardless of how many enemies are piled on. Classic survivors feel.
//
// Runs right after the hash is rebuilt (positions final, indices all valid) and
// before collision compacts the dead, so every queried index is in range.

import type { GameState } from "../state/gameState";
import { ENEMY } from "../data/enemies";
import { PLAYER } from "../data/player";

const candidates: number[] = []; // reused scratch — never per-call alloc

export function updateContact(state: GameState, dt: number): void {
  const p = state.player;

  // Tick i-frames down. While invulnerable, no contact can land — skip the query.
  if (p.invuln > 0) {
    p.invuln -= dt;
    return;
  }

  const e = state.enemies;
  state.hash.queryNeighbors(p.pos.x, p.pos.y, candidates);

  for (let k = 0; k < candidates.length; k++) {
    const ei = candidates[k]!;
    const dx = e.posX[ei]! - p.pos.x;
    const dy = e.posY[ei]! - p.pos.y;
    const rr = p.radius + e.radius;
    if (dx * dx + dy * dy <= rr * rr) {
      p.hp -= ENEMY.contactDamage;
      p.invuln = PLAYER.invulnTime;
      if (p.hp <= 0) {
        p.hp = 0;
        state.gameOver = true;
      }
      break; // one hit opens the window; stop scanning
    }
  }
}
