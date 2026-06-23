// Enemy tunables. The one swarm type for the vertical slice. Code reads these;
// no magic numbers in systems.

export const ENEMY = {
  radius: 12, // collision radius (px)
  speed: 90, // px/sec toward the player
  hp: 30,
  capacity: 4096, // pre-allocated storage ceiling (> spawn target, leaves headroom)
} as const;
