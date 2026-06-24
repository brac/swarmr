// Boss: a single large entity that arrives at the survival deadline. It lives
// outside the swarm pool (too big for the uniform hash), so it moves and takes
// contact damage here, and weapons damage it via damageBoss() on direct overlap.
// Defeating it wins the run.

import type { GameState } from "../state/gameState";
import { BOSS } from "../data/boss";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { PLAYER } from "../data/player";
import { ENEMY } from "../data/enemies";
import { rollHit } from "./combat";

export function updateBoss(state: GameState, dt: number): void {
  const b = state.boss;

  // Arrive at the deadline (once).
  if (!b.active && !state.won && state.time >= BOSS.spawnTime) {
    spawnBoss(state);
  }
  if (!b.active) return;

  // Hit-flash decay.
  if (b.hitTimer > 0) b.hitTimer = b.hitTimer > dt ? b.hitTimer - dt : 0;

  // Seek the player.
  const p = state.player;
  let vx = p.pos.x - b.pos.x;
  let vy = p.pos.y - b.pos.y;
  const d2 = vx * vx + vy * vy;
  if (d2 > 1e-6) {
    const inv = BOSS.speed / Math.sqrt(d2);
    b.pos.x += vx * inv * dt;
    b.pos.y += vy * inv * dt;
  }

  // Contact damage (shares the player's i-frame window with swarm contact).
  if (!state.godMode && p.invuln <= 0) {
    const dx = b.pos.x - p.pos.x;
    const dy = b.pos.y - p.pos.y;
    const rr = p.radius + BOSS.radius;
    if (dx * dx + dy * dy <= rr * rr) {
      p.hp -= 1; // one heart per hit, same as swarm contact
      p.invuln = PLAYER.invulnTime;
      if (p.hp <= 0) {
        p.hp = 0;
        state.gameOver = true;
      }
    }
  }
}

/** Activate the boss just off the right edge; it then seeks the player (advancing
 *  in from the right like the rest of the side-scroller's swarm). */
export function spawnBoss(state: GameState): void {
  const b = state.boss;
  if (b.active || state.won) return;
  b.active = true;
  b.pos.x = WORLD_W + BOSS.radius;
  b.pos.y = WORLD_H / 2;
  b.hp = BOSS.hp;
  b.maxHp = BOSS.hp;
  b.hitTimer = 0;
  b.projHitUntil = 0;
  b.garlicNextHit = 0;
  b.laserNextHit = 0;
}

/**
 * Apply one weapon hit to the boss (variance + crit), flash it, pop a number,
 * and win the run if it drops. Callers gate by overlap (and their own re-hit
 * cooldown) before calling.
 */
export function damageBoss(state: GameState, baseDamage: number): void {
  const b = state.boss;
  const roll = rollHit(state.rng, baseDamage);
  b.hp -= roll.amount;
  b.hitTimer = ENEMY.hitReactTime;
  state.damageNumbers.spawn(
    b.pos.x,
    b.pos.y - BOSS.radius,
    roll.amount,
    roll.crit ? 1 : 0,
  );
  if (b.hp <= 0) {
    b.hp = 0;
    b.active = false;
    state.won = true;
  }
}
