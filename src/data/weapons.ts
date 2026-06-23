// Weapon tunables. Systems read these numbers and hardcode nothing.
// See docs/02-dagger.md.

export const DAGGER = {
  cooldown: 0.5, // seconds between fires
  damage: 10,
  projectileSpeed: 800, // px/sec
  projectileLifetime: 1.5, // seconds
  projectileRadius: 6,
  pierce: 1, // enemies one projectile passes through before despawning
  count: 1, // projectiles per fire (level-up territory later)
} as const;

// Whip — a fixed-arc melee cleave, no projectile. On cooldown it sweeps a wedge
// aimed at the nearest enemy and damages everyone inside it at once (area
// overlap, not a moving entity). Instantaneous: one damage tick per swing, so no
// per-enemy re-hit bookkeeping (that lesson is Garlic's). See CLAUDE.md build order.
export const WHIP = {
  cooldown: 1.1, // seconds between swings
  damage: 14,
  range: 230, // reach (px)
  arcHalfAngle: 0.7, // half-width of the wedge (rad) → ~80° full arc
  strikeTTL: 0.18, // how long the swing graphic lingers/fades (s)
} as const;

// Garlic — a persistent aura centered on the player, no cooldown to "fire". Any
// enemy inside the radius takes damage, but each enemy has its own re-hit cooldown
// (the DoT cadence): once hit it can't be hit again for rehitCooldown seconds.
// That per-entity cooldown is the lesson here — reused by every zone/DoT effect.
export const GARLIC = {
  radius: 120, // aura radius (px)
  damage: 5, // per hit
  rehitCooldown: 0.45, // seconds before the same enemy can be hit again
} as const;
