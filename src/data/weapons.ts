// Weapon tunables. Systems read these numbers and hardcode nothing.
// See docs/02-dagger.md.

export const DAGGER = {
  cooldown: 0.5, // seconds between fires
  damage: 10,
  projectileSpeed: 800, // px/sec
  projectileLifetime: 1.5, // seconds
  projectileRadius: 6,
  pierce: 1, // enemies one projectile passes through before despawning
  count: 1, // projectiles per fire (default; upgrades raise it)
  spread: 0.13, // fan angle between daggers when count > 1 (rad)
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

// Axe — a projectile with gravity. Launched up from the player with a random
// horizontal lean, it arcs over and falls off the bottom of the screen, piercing
// and damaging everything it passes through. The new system it forces: per-
// projectile gravity (the pool was straight-line until now).
export const AXE = {
  cooldown: 1.4, // seconds between throws
  damage: 20,
  radius: 14, // collision radius (px)
  gravity: 900, // downward accel (px/s²) → the parabola
  launchSpeedY: 720, // initial upward speed (px/s)
  launchSpeedX: 200, // max |horizontal| launch speed (px/s), randomized per throw
  spinRate: 14, // visual tumble (rad/s)
  lifetime: 3, // backstop despawn (s); normally it falls off the bottom first
  count: 1, // axes per throw
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
