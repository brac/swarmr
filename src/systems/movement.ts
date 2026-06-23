// Movement systems. Pure functions over GameState: read input/state, mutate
// positions. Fixed dt in, no wall-clock reads.

import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import type { Input } from "../core/input";

export function updatePlayer(state: GameState, input: Input, dt: number): void {
  const ax = input.axisX();
  const ay = input.axisY();
  if (ax === 0 && ay === 0) return;

  // Normalize so diagonals aren't faster.
  const inv = 1 / Math.sqrt(ax * ax + ay * ay);
  const p = state.player;
  const step = p.speed * dt;
  p.pos.x += ax * inv * step;
  p.pos.y += ay * inv * step;

  // Keep the player inside the world bounds.
  if (p.pos.x < p.radius) p.pos.x = p.radius;
  else if (p.pos.x > WORLD_W - p.radius) p.pos.x = WORLD_W - p.radius;
  if (p.pos.y < p.radius) p.pos.y = p.radius;
  else if (p.pos.y > WORLD_H - p.radius) p.pos.y = WORLD_H - p.radius;
}

// Enemies seek the player at fixed speed (the "dumb enemy" of checkpoint 7 —
// pure seek, no separation yet, so this stage isolates renderer + hash cost).
export function updateEnemies(state: GameState, dt: number): void {
  const e = state.enemies;
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const step = e.speed * dt;
  const n = e.count;
  for (let i = 0; i < n; i++) {
    const dx = px - e.posX[i]!;
    const dy = py - e.posY[i]!;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1e-6) {
      const inv = step / Math.sqrt(d2);
      e.posX[i]! += dx * inv;
      e.posY[i]! += dy * inv;
    }
  }
}
