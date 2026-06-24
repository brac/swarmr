// Laser — weapon five, a Cyclops-style sustained beam. The new shape it forces: a
// line-segment hitbox. The Dagger pool throws movers, the Whip cuts a wedge, Garlic
// pulses a disc — the Laser sweeps a long thin rectangle from the player along their
// facing heading, piercing every body on the line at once. It's continuous like Garlic
// (ON for LASER.duration once triggered), so it carries the same per-enemy re-hit gate
// (laserNextHit) instead of dumping a hit every 240Hz frame. The heading is locked from
// the player's facing at trigger time, so a blast reads as one deliberate beam rather
// than a beam that wobbles with every input.
//
// Like the Whip/Garlic it only subtracts HP; collision's end-of-tick compaction sweeps
// the dead and drops gems, so this must run before collision (indices stay valid here).

import type { GameState } from "../../state/gameState";
import { MAX_LASER_SEGMENTS } from "../../state/gameState";
import { LASER } from "../../data/weapons";
import { ENEMY } from "../../data/enemies";
import { BOSS } from "../../data/boss";
import { rollHit } from "../combat";
import { damageBoss } from "../boss";

// Sentinel exclude id meaning "the boss was the last thing hit" — keeps a fork
// from immediately re-splitting on the boss it just struck.
const EXCLUDE_BOSS = -2;
const HIT_EPS = 1e-3; // ignore targets effectively at the segment origin

export function updateLaser(state: GameState, dt: number): void {
  const w = state.weapons.laser;
  if (w.level < 1) {
    // Not acquired — make sure no beam lingers if it was just toggled off.
    state.laserActive = 0;
    state.laserSegments.count = 0;
    return;
  }
  state.laserTimer -= dt;

  // Trigger a fresh blast when the cooldown elapses and one isn't already firing.
  // Lock the beam's heading to the player's facing at this instant. Same cadence
  // for base and Prism — the evolution changes the hit shape, not the rhythm.
  if (state.laserActive <= 0 && state.laserTimer <= 0) {
    // Prism stays ON longer (1000ms) than the base blast (300ms).
    state.laserActive = w.evolved ? LASER.evo.duration : LASER.duration;
    state.laserTimer += w.cooldown / state.passives.fireRateMult;
    state.laserDirX = state.player.facingX;
    state.laserDirY = state.player.facingY;
  }

  if (state.laserActive <= 0) {
    state.laserSegments.count = 0; // beam off → nothing to draw
    return;
  }
  state.laserActive -= dt;

  const now = state.time;
  // Global Damage passive folds into the per-tick damage, like the other weapons.
  // Prism trades per-tick punch for its longer uptime.
  const damage =
    w.damage * state.passives.damageMult * (w.evolved ? LASER.evo.damageMult : 1);

  if (w.evolved) {
    // Prism — recast the splitting tree from the locked heading each active tick.
    state.laserSegments.count = 0;
    castBeam(
      state,
      state.player.pos.x,
      state.player.pos.y,
      state.laserDirX,
      state.laserDirY,
      0,
      LASER.range,
      1, // root width factor
      damage,
      now,
      -1,
    );
    return;
  }

  applyBeam(state, state.laserDirX, state.laserDirY, damage, now);
}

// Cast one Prism beam from (ox,oy) along unit (ux,uy): find the nearest target,
// STOP the drawn segment at it (Prism doesn't run off screen), damage it, then
// reflect into two beams from that point — each shorter and thinner (the beam
// "gets smaller"). Recurses until the reflection cap (5) or the segment buffer
// fills. `exclude` is the target this beam reflected off of (or EXCLUDE_BOSS), so
// a fork doesn't immediately re-hit its own parent.
function castBeam(
  state: GameState,
  ox: number,
  oy: number,
  ux: number,
  uy: number,
  depth: number,
  range: number,
  widthF: number,
  damage: number,
  now: number,
  exclude: number,
): void {
  const segs = state.laserSegments;
  if (segs.count >= MAX_LASER_SEGMENTS) return; // buffer full — stop branching
  const halfW = LASER.width * 0.5 * widthF; // hit test narrows as the beam thins
  const angle = Math.atan2(uy, ux);

  const e = state.enemies;
  const n = e.count;
  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const radius = e.radius;

  // Nearest enemy whose body the segment crosses within [eps, range].
  let bestT = Infinity;
  let bestIdx = -1;
  for (let i = 0; i < n; i++) {
    if (i === exclude || hp[i]! <= 0) continue;
    const rx = posX[i]! - ox;
    const ry = posY[i]! - oy;
    const er = radius[i]!;
    const t = rx * ux + ry * uy;
    if (t <= HIT_EPS || t > range + er) continue;
    const perp = rx * uy - ry * ux;
    const lim = halfW + er;
    if (perp > lim || perp < -lim) continue;
    if (t < bestT) {
      bestT = t;
      bestIdx = i;
    }
  }

  // The boss is outside the hash; test it as another candidate reflection point.
  const b = state.boss;
  let bossHit = false;
  if (b.active && exclude !== EXCLUDE_BOSS) {
    const rx = b.pos.x - ox;
    const ry = b.pos.y - oy;
    const t = rx * ux + ry * uy;
    if (t > HIT_EPS && t <= range + BOSS.radius && t < bestT) {
      const perp = rx * uy - ry * ux;
      const lim = halfW + BOSS.radius;
      if (perp <= lim && perp >= -lim) {
        bestT = t;
        bestIdx = -1;
        bossHit = true;
      }
    }
  }

  // Nothing hit → the beam reaches its max range and dies (no reflection).
  if (bestIdx === -1 && !bossHit) {
    pushSegment(segs, ox, oy, angle, range, widthF);
    return;
  }

  // Hit: the drawn segment stops at the reflection point.
  pushSegment(segs, ox, oy, angle, bestT, widthF);
  const hx = ox + ux * bestT;
  const hy = oy + uy * bestT;

  let nextExclude: number;
  if (bossHit) {
    if (now >= b.laserNextHit) {
      damageBoss(state, damage);
      b.laserNextHit = now + BOSS.laserCooldown;
    }
    nextExclude = EXCLUDE_BOSS;
  } else {
    if (now >= e.laserNextHit[bestIdx]!) {
      const roll = rollHit(state.rng, damage);
      hp[bestIdx]! -= roll.amount;
      e.hitTimer[bestIdx] = ENEMY.hitReactTime;
      e.laserNextHit[bestIdx] = now + LASER.rehitCooldown;
      state.damageNumbers.spawn(
        posX[bestIdx]!,
        posY[bestIdx]! - radius[bestIdx]!,
        roll.amount,
        roll.crit ? 1 : 0,
      );
    }
    nextExclude = bestIdx;
  }

  // Reflect into two shorter, thinner beams from the impact point.
  if (depth < LASER.evo.maxDepth) {
    const childRange = range * LASER.evo.rangeShrink;
    const childWidth = widthF * LASER.evo.widthShrink;
    const forks = LASER.evo.forks;
    for (let f = 0; f < forks; f++) {
      const offset = (f - (forks - 1) / 2) * LASER.evo.splitSpread;
      if (offset === 0) continue; // drop the straight-ahead fork
      castBeam(state, hx, hy, Math.cos(angle + offset), Math.sin(angle + offset), depth + 1, childRange, childWidth, damage, now, nextExclude);
    }
  }
}

function pushSegment(
  segs: GameState["laserSegments"],
  ox: number,
  oy: number,
  angle: number,
  len: number,
  width: number,
): void {
  const i = segs.count;
  segs.ox[i] = ox;
  segs.oy[i] = oy;
  segs.angle[i] = angle;
  segs.len[i] = len;
  segs.width[i] = width;
  segs.count = i + 1;
}

// One straight beam from the player along (ux,uy): damage every enemy on the
// line-segment, gated by each body's re-hit cooldown, then the boss. Factored out
// so Prism can fire several per tick. (ux,uy) must be unit length.
function applyBeam(
  state: GameState,
  ux: number,
  uy: number,
  damage: number,
  now: number,
): void {
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const range = LASER.range;
  const halfW = LASER.width * 0.5;

  // One O(n) pass over the active swarm. A screen-spanning beam's bounding box covers
  // most of the grid anyway, so walking hash cells (as the localized Whip/Garlic do)
  // buys nothing here — a single linear scan with the cheap project-onto-axis test is
  // simpler and still O(n), not O(n²). Allocation-free: all hoisted scalars/arrays.
  const e = state.enemies;
  const n = e.count;
  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const radius = e.radius;
  const hitTimer = e.hitTimer;
  const nextHit = e.laserNextHit;

  for (let i = 0; i < n; i++) {
    if (hp[i]! <= 0) continue; // already dead this tick
    if (now < nextHit[i]!) continue; // re-hit cooldown still ticking
    const rx = posX[i]! - px;
    const ry = posY[i]! - py;
    const er = radius[i]!;
    // Distance along the beam axis; reject behind the muzzle or past the reach.
    const t = rx * ux + ry * uy;
    if (t < -er || t > range + er) continue;
    // Perpendicular distance to the beam line (|cross|, since the axis is unit length).
    const perp = rx * uy - ry * ux;
    const lim = halfW + er;
    if (perp > lim || perp < -lim) continue;

    const roll = rollHit(state.rng, damage);
    hp[i]! -= roll.amount;
    hitTimer[i] = ENEMY.hitReactTime;
    nextHit[i] = now + LASER.rehitCooldown;
    state.damageNumbers.spawn(
      posX[i]!,
      posY[i]! - er,
      roll.amount,
      roll.crit ? 1 : 0,
    );
  }

  // Boss (outside the hash): same axis/perp test, gated by its own re-hit cooldown.
  const b = state.boss;
  if (b.active && now >= b.laserNextHit) {
    const rx = b.pos.x - px;
    const ry = b.pos.y - py;
    const t = rx * ux + ry * uy;
    if (t >= -BOSS.radius && t <= range + BOSS.radius) {
      const perp = rx * uy - ry * ux;
      const lim = halfW + BOSS.radius;
      if (perp <= lim && perp >= -lim) {
        damageBoss(state, damage);
        b.laserNextHit = now + BOSS.laserCooldown;
      }
    }
  }
}
