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
// the boss phase (BOSS.spawnTime = 600s = 10:00). Dumping all 2,500 in the first ~2s
// (the old behavior) was unfun; this gives the run a build.
//
// Current target at time t (seconds) is a clamped linear interpolation:
//   startCount  at  t = 0
//   rampToCount at  t >= rampSeconds   (held thereafter)
// The dev menu can override this live (state.spawnTargetOverride).
export const RAMP = {
  startCount: 5, // enemies the run opens with — a gentle trickle that ramps up
  rampToCount: 2500, // the north-star entity count, reached at rampSeconds
  rampSeconds: 540, // 9:00 of ramp; the last minute (→ boss at 10:00) holds at 2500
} as const;

export const DIFFICULTY = {
  // Enemy HP multiplier grows linearly with elapsed time: 1 + minutes × this.
  // At 0.6/min the swarm is ~6.4× tougher by 9:00, so a late-game mob soaks the
  // combined hit of several heavily-upgraded weapons before it drops.
  hpRampPerMin: 0.6, // +60% enemy HP per minute survived

  // Spawn-weight tiers by elapsed seconds. Each tier's `w` is the relative spawn
  // weight per ENEMY_TYPES index — order is:
  //   [grunt, runner, tank, goblin, biter, carapace, hellhound, serpent]
  // The spawner uses the latest tier whose time has been reached, so each row
  // phases a new body into the mix. The run opens on grunts only; the mid-game
  // roster widens through the first five minutes; the two APEX elites (hellhound,
  // serpent — indices 6,7) stay at weight 0 until t:420 so the hardest mobs never
  // appear before 7:00.
  tiers: [
    { t: 0, w: [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }, // 0:00 — grunts only
    { t: 20, w: [0.7, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] }, // 0:20 — + runners
    { t: 60, w: [0.5, 0.3, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0] }, // 1:00 — + goblins (pack)
    { t: 90, w: [0.42, 0.26, 0.12, 0.2, 0.0, 0.0, 0.0, 0.0] }, // 1:30 — + tanks
    { t: 180, w: [0.34, 0.24, 0.12, 0.18, 0.12, 0.0, 0.0, 0.0] }, // 3:00 — + biters
    { t: 300, w: [0.27, 0.21, 0.12, 0.16, 0.13, 0.11, 0.0, 0.0] }, // 5:00 — + carapace
    { t: 420, w: [0.2, 0.18, 0.11, 0.13, 0.13, 0.11, 0.08, 0.06] }, // 7:00 — + ELITES
    { t: 540, w: [0.16, 0.15, 0.11, 0.12, 0.13, 0.12, 0.11, 0.1] }, // 9:00 — elites ramp
  ],
} as const;

// Set-piece formations, spawned in addition to the ambient stream on a sim-time
// cadence. Two flavors: a RUSH pack (a tight cluster of fast mobs that homes the
// player as a group) and a WALL (a vertical line of slow, high-HP mobs that advances
// and closes toward the player's row — the "smush"). Counts are deliberately modest
// so they read as events, not a second swarm. Enemy type indices reference
// ENEMY_TYPES (1 = Runner, 5 = Carapace).
export const FORMATIONS = {
  firstAt: 75, // s before the first formation event
  interval: 20, // s between events…
  jitter: 6, // …±this many seconds (seeded)
  rush: {
    startAt: 75, // rushes begin here
    type: 1, // Runner — fast
    count: 20, // mobs per pack
    spreadX: 170, // how deep the cluster stacks behind the right edge (px)
    spreadY: 110, // cluster half-height (px)
  },
  wall: {
    startAt: 165, // 2:45 — walls join the rotation later
    type: 5, // Carapace — slow HP sponge
    count: 11, // mobs in the vertical line
    marginY: 80, // keep the ends off the very top/bottom (px)
    staggerX: 70, // slight per-mob depth stagger so they don't share one hash cell (px)
  },
} as const;
