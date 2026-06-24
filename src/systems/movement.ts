// Movement systems. Pure functions over GameState: read input/state, mutate
// positions. Fixed dt in, no wall-clock reads.

import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import type { Input } from "../core/input";
import { ENEMY } from "../data/enemies";
import { MOVE_HOMING } from "../state/enemies";

// Enemies that stream past the player and off the left edge are despawned here
// (they'd otherwise drift forever off-screen, eating the capacity). Generous
// margin so nothing pops while still partly visible.
const CULL_LEFT = -120;

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

  // Facing is locked to the right in side-scroller mode: the Laser and the evolved
  // Dagger stream always fire downrange at the incoming swarm, regardless of dodge
  // direction. (facing stays at its (1,0) init — see createGameState.)

  // Keep the player inside the world bounds.
  if (p.pos.x < p.radius) p.pos.x = p.radius;
  else if (p.pos.x > WORLD_W - p.radius) p.pos.x = WORLD_W - p.radius;
  if (p.pos.y < p.radius) p.pos.y = p.radius;
  else if (p.pos.y > WORLD_H - p.radius) p.pos.y = WORLD_H - p.radius;
}

// Enemies move (by their per-enemy MOVE_* behavior) and push apart from neighbors
// (separation). The separation query rides the spatial hash — the reason the hash
// exists. It reads last tick's hash (rebuilt after this system runs); one frame of
// staleness is invisible for steering. Side-scroller default is straight right-to-
// left; HOMING (the original seek) is kept for future movement types.
export function updateEnemies(state: GameState, dt: number): void {
  const e = state.enemies;
  const h = state.hash;
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const speeds = e.speed;
  const move = e.move;
  const sepR2 = ENEMY.sepRadius * ENEMY.sepRadius;
  const sepStrength = ENEMY.sepStrength;
  const n = e.count;

  // Hoist grid internals out of the hot loop. Separation reads last tick's grid
  // (rebuilt after this system); indices may lag by a tick — fine for steering,
  // and the j>=n guard skips any that are now out of the active range.
  const posX = e.posX;
  const posY = e.posY;
  const hitTimer = e.hitTimer;
  const cellStart = h.cellStart;
  const items = h.items;
  const gridW = h.gridW;
  const gridH = h.gridH;

  for (let i = 0; i < n; i++) {
    const ex = posX[i]!;
    const ey = posY[i]!;

    // Decay the hit-react timer (drives the renderer's flash + scale punch).
    const ht = hitTimer[i]!;
    if (ht > 0) hitTimer[i] = ht > dt ? ht - dt : 0;

    // Base velocity by movement type.
    let vx: number;
    let vy: number;
    if (move[i] === MOVE_HOMING) {
      // Seek the player as a unit vector × this enemy's speed.
      vx = px - ex;
      vy = py - ey;
      const d2 = vx * vx + vy * vy;
      if (d2 > 1e-6) {
        const inv = speeds[i]! / Math.sqrt(d2);
        vx *= inv;
        vy *= inv;
      } else {
        vx = 0;
        vy = 0;
      }
    } else {
      // Straight right-to-left at this enemy's speed (side-scroller default).
      vx = -speeds[i]!;
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

  // Cull anything that has streamed off the left edge. Backward swap-remove so the
  // element pulled into slot i was already visited this pass.
  for (let i = e.count - 1; i >= 0; i--) {
    if (posX[i]! < CULL_LEFT) e.kill(i);
  }
}
