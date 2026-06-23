// Boss tunables. One boss spawns at the survival deadline; killing it wins the
// run. It's handled outside the swarm pool (too big for the uniform hash, and
// singular), so weapons hit it via direct overlap checks gated by its own
// per-source re-hit cooldowns.

export const BOSS = {
  spawnTime: 600, // seconds survived before the boss arrives (10:00)
  hp: 5000,
  radius: 55, // collision + visual radius (px)
  speed: 72, // px/sec toward the player (slow, but it pressures you)
  contactDamage: 34, // per i-frame window on touch
  color: 0x7a0a2a, // dark crimson
  // Projectiles hitting the boss are throttled globally (else one dwelling axe
  // with infinite pierce would melt it instantly). With whip + garlic on top this
  // sets the fight to a dramatic ~30s. All four numbers are the boss-fight dials.
  rehitGap: 0.08, // min seconds between projectile hits on the boss
  garlicCooldown: 0.4, // min seconds between garlic ticks on the boss
} as const;
