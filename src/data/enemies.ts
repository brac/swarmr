// Enemy tunables. The one swarm type for the vertical slice. Code reads these;
// no magic numbers in systems.

export const ENEMY = {
  radius: 12, // collision radius (px)
  speed: 90, // px/sec toward the player
  hp: 30,
  contactDamage: 10, // damage dealt to the player on touch (once per i-frame window)
  capacity: 4096, // pre-allocated storage ceiling (> spawn target, leaves headroom)
  // Separation (boids-style): push apart from neighbors so the swarm spreads
  // into a packed front instead of collapsing onto the player's exact point.
  sepRadius: 22, // start repelling within this distance (≈ enemy diameter)
  sepStrength: 130, // push speed contribution (px/sec) at max closeness
} as const;
