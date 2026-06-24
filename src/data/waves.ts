// Spawn / wave / difficulty config. The swarm ramps to the entity-count target,
// while the *composition* (which enemy types) and enemy HP scale up over the run
// so the difficulty has an arc.

export const SPAWN = {
  // The live spawn cap is NOT a constant — it ramps over the run (see RAMP below)
  // so the opening isn't an instant wall of 2,000 enemies. `perTick` caps how fast
  // we close the gap to whatever the *current* target is on any given tick.
  perTick: 4, // enemies spawned per logic tick while below the current target
} as const;

// Progressive swarm ramp. The crowd grows from a small opening to the north-star
// count over the first ~9 minutes, then holds flat for the final minute — which is
// the boss phase (BOSS.spawnTime = 600s = 10:00). Dumping all 2,000 in the first ~2s
// (the old behavior) was unfun; this gives the run a build.
//
// Current target at time t (seconds) is a clamped linear interpolation:
//   startCount  at  t = 0
//   rampToCount at  t >= rampSeconds   (held thereafter)
export const RAMP = {
  startCount: 5, // enemies the run opens with — a gentle trickle that ramps up
  rampToCount: 2000, // the north-star entity count, reached at rampSeconds
  rampSeconds: 540, // 9:00 of ramp; the last minute (→ boss at 10:00) holds at 2000
} as const;

export const DIFFICULTY = {
  // Enemy HP multiplier grows linearly with elapsed time: 1 + minutes × this.
  hpRampPerMin: 0.5, // +50% enemy HP per minute survived

  // Spawn-weight tiers by elapsed seconds. Each tier's `w` is the relative spawn
  // weight per ENEMY_TYPES index [grunt, runner, tank]; the spawner uses the
  // latest tier whose time has been reached. Early = all grunts; tougher types
  // and tanks phase in as the run goes on.
  tiers: [
    { t: 0, w: [1, 0, 0] },
    { t: 25, w: [0.7, 0.3, 0] },
    { t: 75, w: [0.5, 0.3, 0.2] },
    { t: 150, w: [0.35, 0.35, 0.3] },
  ],
} as const;
