// Spawn / wave / difficulty config. The swarm ramps to the entity-count target,
// while the *composition* (which enemy types) and enemy HP scale up over the run
// so the difficulty has an arc.

export const SPAWN = {
  targetCount: 2000, // the north-star entity count
  perTick: 4, // enemies spawned per logic tick until target (240Hz → ~2s ramp)
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
