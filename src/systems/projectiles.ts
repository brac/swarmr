// Projectile movement + lifetime. Straight-line travel; despawn on lifetime
// expiry or once off the world (with a margin so they don't pop at the edge).

import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";

const OFF_MARGIN = 64;

export function updateProjectiles(state: GameState, dt: number): void {
  const p = state.projectiles;
  // Iterate downward so swap-remove (kill) doesn't skip the swapped-in element.
  for (let i = p.count - 1; i >= 0; i--) {
    const x = (p.posX[i]! += p.velX[i]! * dt);
    const y = (p.posY[i]! += p.velY[i]! * dt);
    p.life[i]! -= dt;
    if (
      p.life[i]! <= 0 ||
      x < -OFF_MARGIN ||
      x > WORLD_W + OFF_MARGIN ||
      y < -OFF_MARGIN ||
      y > WORLD_H + OFF_MARGIN
    ) {
      p.kill(i);
    }
  }
}
