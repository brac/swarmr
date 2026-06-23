// Movement systems. Pure functions over GameState: read input/state, mutate
// positions. Fixed dt in, no wall-clock reads.

import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import type { Input } from "../core/input";
import { ENEMY } from "../data/enemies";

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

// Enemies seek the player and push apart from neighbors (separation). The
// separation query rides the spatial hash — the reason the hash exists. It reads
// last tick's hash (rebuilt after this system runs); one frame of staleness is
// invisible for steering.
export function updateEnemies(state: GameState, dt: number): void {
  const e = state.enemies;
  const h = state.hash;
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const speed = e.speed;
  const sepR2 = ENEMY.sepRadius * ENEMY.sepRadius;
  const sepStrength = ENEMY.sepStrength;
  const n = e.count;

  // Hoist grid internals out of the hot loop. Separation reads last tick's grid
  // (rebuilt after this system); indices may lag by a tick — fine for steering,
  // and the j>=n guard skips any that are now out of the active range.
  const posX = e.posX;
  const posY = e.posY;
  const cellStart = h.cellStart;
  const items = h.items;
  const gridW = h.gridW;
  const gridH = h.gridH;

  for (let i = 0; i < n; i++) {
    const ex = posX[i]!;
    const ey = posY[i]!;

    // Seek the player as a unit vector × speed.
    let vx = px - ex;
    let vy = py - ey;
    const d2 = vx * vx + vy * vy;
    if (d2 > 1e-6) {
      const inv = speed / Math.sqrt(d2);
      vx *= inv;
      vy *= inv;
    } else {
      vx = 0;
      vy = 0;
    }

    // Separation: push away from each close neighbor, weighted stronger the
    // closer it is. Walk the 3x3 grid block directly — no candidate array.
    const cx = h.clampCX(ex);
    const cy = h.clampCY(ey);
    let sx = 0;
    let sy = 0;
    const gyLo = cy > 0 ? cy - 1 : 0;
    const gyHi = cy < gridH - 1 ? cy + 1 : gridH - 1;
    const gxLo = cx > 0 ? cx - 1 : 0;
    const gxHi = cx < gridW - 1 ? cx + 1 : gridW - 1;
    for (let gy = gyLo; gy <= gyHi; gy++) {
      const rowBase = gy * gridW;
      for (let gx = gxLo; gx <= gxHi; gx++) {
        const c = rowBase + gx;
        const end = cellStart[c + 1]!;
        for (let p = cellStart[c]!; p < end; p++) {
          const j = items[p]!;
          if (j === i || j >= n) continue; // self, or a stale index
          const dx = ex - posX[j]!;
          const dy = ey - posY[j]!;
          const nd2 = dx * dx + dy * dy;
          if (nd2 > 1e-6 && nd2 < sepR2) {
            const w = (sepR2 - nd2) / sepR2;
            const inv = 1 / Math.sqrt(nd2);
            sx += dx * inv * w;
            sy += dy * inv * w;
          }
        }
      }
    }
    vx += sx * sepStrength;
    vy += sy * sepStrength;

    posX[i] = ex + vx * dt;
    posY[i] = ey + vy * dt;
  }
}
