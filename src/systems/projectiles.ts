// Projectile movement + lifetime. Straight-line by default; projectiles with a
// gravity term (axes) arc. Despawn rules differ by kind: a straight projectile
// pops once it leaves any edge (+margin); an axe is launched UP and is meant to
// sail above the top and fall back, so it only despawns off the bottom (or by
// lifetime as a backstop).

import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { PROJ_AXE, PROJ_LIGHT } from "../state/projectiles";
import { AXE } from "../data/weapons";

const OFF_MARGIN = 64;

export function updateProjectiles(state: GameState, dt: number): void {
  const p = state.projectiles;
  // Iterate downward so swap-remove (kill) doesn't skip the swapped-in element.
  for (let i = p.count - 1; i >= 0; i--) {
    const g = p.gravity[i]!;
    if (g !== 0) p.velY[i]! += g * dt; // arc

    const x = (p.posX[i]! += p.velX[i]! * dt);
    let y = (p.posY[i]! += p.velY[i]! * dt);
    p.life[i]! -= dt;

    const kind = p.kind[i]!;

    // Piercing Light reflects off the top/bottom edges (flip velY, clamp back to
    // the edge) until its bounce budget runs out — then it sails off and despawns.
    if (kind === PROJ_LIGHT && p.reflectionsLeft[i]! > 0) {
      if (y < 0) {
        y = p.posY[i]! = 0;
        p.velY[i]! = -p.velY[i]!;
        p.reflectionsLeft[i]!--;
      } else if (y > WORLD_H) {
        y = p.posY[i]! = WORLD_H;
        p.velY[i]! = -p.velY[i]!;
        p.reflectionsLeft[i]!--;
      }
    }

    let dead = p.life[i]! <= 0;
    if (!dead) {
      if (kind === PROJ_AXE) {
        p.spin[i]! += AXE.spinRate * dt; // tumble
        // Forward-arcing axes leave the right edge or fall off the bottom.
        dead = x > WORLD_W + OFF_MARGIN || y > WORLD_H + OFF_MARGIN;
      } else {
        // Daggers and spent light rays pop once they leave any edge (+margin).
        dead =
          x < -OFF_MARGIN ||
          x > WORLD_W + OFF_MARGIN ||
          y < -OFF_MARGIN ||
          y > WORLD_H + OFF_MARGIN;
      }
    }
    if (dead) p.kill(i);
  }
}
