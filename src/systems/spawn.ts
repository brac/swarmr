// Spawn system. Ramps the swarm to the target count by emitting enemies along the
// RIGHT edge each tick — this is a side-scroller, so the horde streams in from the
// right toward the player on the left. The enemy *type* and an HP scale are chosen
// from the difficulty curve (which keys off elapsed sim time), so the run gets
// harder: tougher types phase in and every enemy gets beefier. The dev menu can
// pin the live cap via state.spawnTargetOverride. All randomness is seeded.

import type { GameState } from "../state/gameState";
import type { Rng } from "../core/rng";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { SPAWN, RAMP, DIFFICULTY, FORMATIONS } from "../data/waves";
import { ENEMY_TYPES, MOVE_TUNING } from "../data/enemies";
import { MOVE_SINE, MOVE_HOMING, MOVE_WALL } from "../state/enemies";

const TAU = Math.PI * 2;

export function updateSpawn(state: GameState): void {
  const e = state.enemies;
  const time = state.time;

  // Current swarm cap: ease-IN ramp from startCount → rampToCount over rampSeconds,
  // then held. We square the 0..1 progress (`tn*tn`) so the opening minutes stay
  // gentle and the crowd only piles on in the back half — a plain linear ramp added
  // the same count every second, which buried the player before they could dig in.
  // `| 0` floors to an integer count; plain arithmetic keeps this hot path clean.
  // The dev slider pins the live cap when set (≥0); otherwise the ramp drives it.
  let target: number;
  if (state.spawnTargetOverride >= 0) {
    target = state.spawnTargetOverride;
  } else {
    const tn0 = time >= RAMP.rampSeconds ? 1 : time / RAMP.rampSeconds; // 0..1 progress
    const tn = tn0 * tn0; // quadratic ease-in
    target = (RAMP.startCount + (RAMP.rampToCount - RAMP.startCount) * tn) | 0;
  }
  if (e.count >= target) return;

  const rng = state.rng;
  const hpScale = 1 + (time / 60) * DIFFICULTY.hpRampPerMin;

  for (let n = 0; n < SPAWN.perTick && e.count < target; n++) {
    // Side-scroller: every spawn enters from the right edge at a random height.
    const x = WORLD_W;
    const y = rng.range(0, WORLD_H);
    const type = pickType(rng, time);
    // A fraction of the ground-stream bodies weave on a sine wave instead of going
    // straight (elites keep their own homing behavior — only plain movers convert).
    let move: number | undefined;
    let phase = 0;
    if (ENEMY_TYPES[type]!.move === undefined && rng.next() < MOVE_TUNING.sineChance) {
      move = MOVE_SINE;
      phase = rng.next() * TAU;
    }
    e.spawn(x, y, type, hpScale, move, phase);
  }
}

// Set-piece formations on a sim-time cadence, on TOP of the ambient stream. Either a
// fast homing RUSH pack or a slow advancing WALL. Seeded throughout. Spawns ignore the
// ambient target (they're events) but respect pool capacity (spawn() returns -1 full).
export function updateFormations(state: GameState): void {
  const time = state.time;
  if (time < state.nextFormationAt) return;

  const rng = state.rng;
  const hpScale = 1 + (time / 60) * DIFFICULTY.hpRampPerMin;

  // Pick a flavor: walls only once unlocked, otherwise a rush; a coin flip after that.
  if (time >= FORMATIONS.wall.startAt && rng.next() < 0.5) {
    spawnWall(state, hpScale);
  } else {
    spawnRush(state, rng, hpScale);
  }

  // Schedule the next event with seeded jitter.
  const jitter = (rng.next() * 2 - 1) * FORMATIONS.jitter;
  state.nextFormationAt = time + FORMATIONS.interval + jitter;
}

// A tight cluster of fast mobs at the right edge, all homing the player as a group.
function spawnRush(state: GameState, rng: Rng, hpScale: number): void {
  const cfg = FORMATIONS.rush;
  const cy = rng.range(cfg.spreadY, WORLD_H - cfg.spreadY); // cluster center row
  for (let i = 0; i < cfg.count; i++) {
    const x = WORLD_W + rng.range(0, cfg.spreadX);
    const y = cy + rng.range(-cfg.spreadY, cfg.spreadY);
    state.enemies.spawn(x, y, cfg.type, hpScale, MOVE_HOMING);
  }
}

// A vertical line of slow, high-HP mobs that advances and closes toward the player.
function spawnWall(state: GameState, hpScale: number): void {
  const cfg = FORMATIONS.wall;
  const top = cfg.marginY;
  const span = WORLD_H - cfg.marginY * 2;
  for (let i = 0; i < cfg.count; i++) {
    const y = top + (span * i) / (cfg.count - 1);
    const x = WORLD_W + (i % 2) * cfg.staggerX; // alternate depth so they don't share a cell
    state.enemies.spawn(x, y, cfg.type, hpScale, MOVE_WALL);
  }
}

// Weighted-random enemy type from the latest difficulty tier reached. Index loops
// only — runs up to perTick× per tick, so it stays allocation-free.
function pickType(rng: Rng, time: number): number {
  const tiers = DIFFICULTY.tiers;
  let w: readonly number[] = tiers[0]!.w;
  for (let i = 1; i < tiers.length; i++) {
    if (time >= tiers[i]!.t) w = tiers[i]!.w;
    else break;
  }

  let total = 0;
  for (let i = 0; i < w.length; i++) total += w[i]!;
  let r = rng.next() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i]!;
    if (r <= 0) return i;
  }
  return 0;
}
