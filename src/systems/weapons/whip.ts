// Whip — weapon two. The lesson it forces: a non-projectile, area-overlap damage
// source. No pooled mover, no travel time. On cooldown it picks the nearest enemy
// as an aim direction, then damages every enemy inside a fixed wedge (range +
// half-angle) in a single instantaneous tick.
//
// Death handling is intentionally outsourced: the whip only subtracts HP. The
// collision system's end-of-tick compaction pass sweeps every hp<=0 enemy
// (whip-killed or projectile-killed) — so the whip MUST run before collision.
// That also means the hash indices it reads are all still valid (nothing has been
// swap-removed yet this tick).

import type { GameState } from "../../state/gameState";
import { WHIP } from "../../data/weapons";
import { nearestEnemy } from "../targeting";

export function updateWhip(state: GameState, dt: number): void {
  // Age out lingering swing visuals every tick, independent of the cooldown.
  const ws = state.whipStrikes;
  for (let i = ws.count - 1; i >= 0; i--) {
    ws.age[i]! += dt;
    if (ws.age[i]! >= WHIP.strikeTTL) ws.kill(i);
  }

  state.whipTimer -= dt;
  if (state.whipTimer > 0) return;

  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const target = nearestEnemy(state, px, py);
  if (target === -1) {
    state.whipTimer = 0; // hold at 0 so we swing the instant an enemy appears
    return;
  }

  const e = state.enemies;
  // Aim unit vector toward the nearest enemy.
  const adx = e.posX[target]! - px;
  const ady = e.posY[target]! - py;
  const invLen = 1 / Math.sqrt(adx * adx + ady * ady || 1);
  const ux = adx * invLen;
  const uy = ady * invLen;
  const angle = Math.atan2(uy, ux);

  // Walk the cell block covering the wedge's bounding box; damage every enemy
  // within range AND within the arc. Arc test is a dot product vs cos(halfAngle)
  // — no atan2 per enemy.
  const range2 = WHIP.range * WHIP.range;
  const cosHalf = Math.cos(WHIP.arcHalfAngle);
  const h = state.hash;
  const cxLo = h.clampCX(px - WHIP.range);
  const cxHi = h.clampCX(px + WHIP.range);
  const cyLo = h.clampCY(py - WHIP.range);
  const cyHi = h.clampCY(py + WHIP.range);

  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const radius = e.radius;
  const cellStart = h.cellStart;
  const items = h.items;
  const gridW = h.gridW;

  for (let gy = cyLo; gy <= cyHi; gy++) {
    const rowBase = gy * gridW;
    for (let gx = cxLo; gx <= cxHi; gx++) {
      const c = rowBase + gx;
      const end = cellStart[c + 1]!;
      for (let pp = cellStart[c]!; pp < end; pp++) {
        const j = items[pp]!;
        if (hp[j]! <= 0) continue; // already dead this tick
        const dx = posX[j]! - px;
        const dy = posY[j]! - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > range2 || d2 < 1e-6) continue;
        // Inside the wedge? cos of the angle between aim and enemy ≥ cos(half).
        const invd = 1 / Math.sqrt(d2);
        if ((dx * ux + dy * uy) * invd < cosHalf) continue;

        hp[j]! -= WHIP.damage;
        state.damageNumbers.spawn(posX[j]!, posY[j]! - radius, WHIP.damage);
      }
    }
  }

  ws.spawn(px, py, angle); // lingering visual; collision compacts the dead later
  state.whipTimer += WHIP.cooldown;
}
