// Enemy tunables. The one swarm type for the vertical slice. Code reads these;
// no magic numbers in systems.

export const ENEMY = {
  radius: 12, // collision radius (px)
  speed: 90, // px/sec toward the player
  hp: 30,
  color: 0xff5566, // base tint (the renderer reads this; hit-flash lerps off it)
  contactDamage: 10, // damage dealt to the player on touch (once per i-frame window)
  capacity: 4096, // pre-allocated storage ceiling (> spawn target, leaves headroom)
  // Hit reaction (juice): on taking damage an enemy flashes toward hitFlashColor
  // and scale-punches, both decaying over hitReactTime. Pure visual — no gameplay.
  hitReactTime: 0.13, // seconds the flash + wobble lasts
  hitFlashColor: 0xffffff, // peak flash tint; decays back to `color`
  hitWobble: 0.4, // extra scale at the moment of impact (1 → 1.4)
  // Separation (boids-style): push apart from neighbors so the swarm spreads
  // into a packed front instead of collapsing onto the player's exact point.
  sepRadius: 22, // start repelling within this distance (≈ enemy diameter)
  sepStrength: 130, // push speed contribution (px/sec) at max closeness
} as const;
