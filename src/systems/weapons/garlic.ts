// Garlic — now "Piercing Light". The lesson it forces is unchanged in spirit (a
// continuous-pressure area weapon) but the shape is a fast REFLECTING projectile:
// a single ray fired at 45° up or down, aimed toward the nearest enemy, that bounces
// off the top/bottom world edges (see updateProjectiles) and pierces every body it
// crosses. It rides the existing projectile pool + collision exactly like the Axe —
// infinite pierce, and the shared per-enemy projectile re-hit gate stops one body
// from soaking every tick — so this file only has to LAUNCH rays on a cooldown.

import type { GameState } from "../../state/gameState";
import { GARLIC } from "../../data/weapons";
import { PROJ_LIGHT, PIERCE_INFINITE } from "../../state/projectiles";
import { nearestEnemy } from "../targeting";

export function updateGarlic(state: GameState, dt: number): void {
  const g = state.weapons.garlic;
  if (g.level < 1) return; // not acquired — no rays
  state.lightTimer -= dt;
  if (state.lightTimer > 0) return;

  const px = state.player.pos.x;
  const py = state.player.pos.y;

  // Aim toward the nearest enemy, snapped to ±45°: fire up if it's above us, down if
  // below (horizontal component always forward). With no enemy, hold the cooldown at
  // 0 so the next ray fires the instant one appears — don't waste shots into space.
  const target = nearestEnemy(state, px, py);
  if (target === -1) {
    state.lightTimer = 0;
    return;
  }
  const sy = state.enemies.posY[target]! < py ? -1 : 1; // up (−) or down (+)

  // Global Damage passive folds in at the source; AoE passive fattens the beam.
  const damage = g.damage * state.passives.damageMult;
  const radius = g.radius * state.passives.aoeMult;
  const reflections = GARLIC.maxReflections + (g.evolved ? GARLIC.evo.extraReflections : 0);

  // 45° diagonal: equal forward (+x) and vertical components.
  const vx = GARLIC.speed * Math.SQRT1_2;
  const vy = GARLIC.speed * Math.SQRT1_2;

  fireRay(state, px, py, vx, sy * vy, radius, damage, reflections);
  // Refraction (evolved) fires the opposite diagonal too — one ray up, one down.
  if (g.evolved) fireRay(state, px, py, vx, -sy * vy, radius, damage, reflections);

  // Global Fire Rate passive shortens the effective cooldown (faster = divide).
  const cooldown = g.evolved ? GARLIC.cooldown * GARLIC.evo.cooldownMult : GARLIC.cooldown;
  state.lightTimer += cooldown / state.passives.fireRateMult;
}

// Spawn one light ray into the projectile pool and seed its bounce budget.
function fireRay(
  state: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  damage: number,
  reflections: number,
): void {
  const idx = state.projectiles.spawn(
    x,
    y,
    vx,
    vy,
    GARLIC.lifetime,
    radius,
    damage,
    PIERCE_INFINITE, // carve through every enemy until off-screen
    0, // gravity off — straight lines between reflections
    PROJ_LIGHT,
  );
  if (idx !== -1) state.projectiles.reflectionsLeft[idx] = reflections;
}
