// Weapon tunables. Systems read these numbers and hardcode nothing.
// See docs/02-dagger.md.

export const DAGGER = {
  cooldown: 0.5, // seconds between fires
  damage: 14,
  projectileSpeed: 800, // px/sec
  projectileLifetime: 1.5, // seconds
  projectileRadius: 14, // chunky blades — drives both the hitbox and the sprite scale
  pierce: 1, // enemies one projectile passes through before despawning
  count: 1, // projectiles per fire (default; upgrades raise it)
  spread: 0.13, // fan angle between daggers when count > 1 (rad)
  // Thousand Fangs (evolution) — drops the auto-aim fan for THREE parallel daggers
  // hosed out along the player's facing as a fat, fast-moving row, fired constantly
  // and piercing nothing (each stops at its first hit). Damage stays live (w.damage,
  // so the 4 stat picks carry over); lifetime/radius reuse the base consts. See docs/05.
  evo: {
    cooldown: 0.05, // near-constant fire
    streams: 3, // parallel daggers forming the row
    rowSpacing: 9, // perpendicular px between adjacent streams
    speedMult: 1.6, // faster than the base dagger
  },
} as const;

// Whip — a fixed-arc melee cleave, no projectile. On cooldown it sweeps a wedge
// aimed at the nearest enemy and damages everyone inside it at once (area
// overlap, not a moving entity). Instantaneous: one damage tick per swing, so no
// per-enemy re-hit bookkeeping (that lesson is Garlic's). See CLAUDE.md build order.
export const WHIP = {
  cooldown: 1.1, // seconds between swings
  damage: 18,
  range: 230, // reach (px)
  arcHalfAngle: 0.7, // half-width of the wedge (rad) → ~80° full arc
  strikeTTL: 0.18, // how long the swing graphic lingers/fades (s)
  // Reaper (evolution) — keeps the wedge, but alternates the swing front → back →
  // front on a faster cadence (the nearest-enemy aim is flipped 180° every other
  // swing) at extended reach. See docs/05.
  evo: {
    range: 300, // reach (px) — wider than the base 230
    cooldown: 0.5, // faster swings drive the front/back rhythm
  },
} as const;

// Axe — a projectile with gravity. Launched up from the player with a random
// horizontal lean, it arcs over and falls off the bottom of the screen, piercing
// and damaging everything it passes through. The new system it forces: per-
// projectile gravity (the pool was straight-line until now).
export const AXE = {
  cooldown: 1.4, // seconds between throws
  damage: 26,
  radius: 14, // collision radius (px)
  gravity: 900, // downward accel (px/s²) → the parabola
  launchSpeedY: 720, // initial upward speed (px/s)
  launchSpeedX: 200, // max |horizontal| launch speed (px/s), randomized per throw
  spinRate: 14, // visual tumble (rad/s)
  lifetime: 3, // backstop despawn (s); normally it falls off the bottom first
  count: 1, // axes per throw
  // Cyclone (evolution) — gravity off; each throw fires `count` axes evenly
  // around a ring whose base angle advances every throw, so successive volleys
  // trace an outward spiral. See docs/05.
  evo: {
    count: 8, // axes per ring — 8 directions out of the player
    speed: 360, // outward px/s (replaces the parabolic launch)
    turn: 0.55, // rad the ring's base angle advances each throw
    cooldown: 0.5, // s between rings
    radiusMult: 2, // axes are 100% bigger
  },
} as const;

// Garlic — a persistent aura centered on the player, no cooldown to "fire". Any
// enemy inside the radius takes damage, but each enemy has its own re-hit cooldown
// (the DoT cadence): once hit it can't be hit again for rehitCooldown seconds.
// That per-entity cooldown is the lesson here — reused by every zone/DoT effect.
export const GARLIC = {
  radius: 120, // aura radius (px)
  damage: 7, // per hit
  rehitCooldown: 0.45, // seconds before the same enemy can be hit again
  // Black Aura (evolution) — wider, far harder, and faster-ticking; the renderer
  // recolors it dark. radius/damage fold into the live stats on pickup (so the
  // existing aura scaling just works); only the faster cadence is read at runtime.
  // See docs/05.
  evo: {
    radiusMult: 1.6, // applied to the live radius stat on evolve
    damageMult: 3, // applied to the live damage stat on evolve
    rehitCooldown: 0.28, // faster re-tick than the base 0.45
    tendrilTTL: 0.18, // seconds a "reach out and zap" tendril lingers per hit
  },
} as const;

// Laser — a Cyclops-style sustained beam. The new shape it forces: a line-segment
// hitbox (a long thin rectangle), unlike the projectile pool, the whip's wedge, or
// garlic's disc. On cooldown it switches ON for `duration` and fires in the player's
// facing direction (locked at trigger time), piercing every enemy along the line.
// Like garlic it's continuous, so it carries a per-enemy re-hit cooldown — the beam
// re-ticks a body every `rehitCooldown`, not every 240Hz frame. Facing is the other
// new concept it forces (the swarm's auto-aim weapons never needed a player heading).
export const LASER = {
  cooldown: 3.0, // seconds between beams (trigger-to-trigger)
  duration: 0.3, // seconds the beam stays ON once triggered (the 300ms blast)
  damage: 26, // per re-hit tick — hits hard (base and Prism share this stat)
  range: 2500, // beam length (px) — overshoots the world diagonal so it always runs off-screen
  width: 18, // beam thickness (px); half-width is the hit test's perpendicular limit
  rehitCooldown: 0.1, // per-enemy seconds between beam ticks (→ ~3 hits over a blast)
  // Prism (evolution) — fires on the SAME cadence as the base beam, but UNLIKE the
  // base beam it does NOT run off screen: each beam stops at what it reflects off
  // of, splits into two, and shrinks (shorter reach + thinner). Gone after 5
  // reflections. Chain-lightning that fizzles out. See docs/05.
  evo: {
    // Three fork directions around the incoming heading, but the center one (which
    // would run straight ahead) is dropped — so each reflection emits the two outer
    // beams, splayed at ±splitSpread.
    forks: 3,
    maxDepth: 5, // a beam at depth < maxDepth may reflect (root is depth 0 → 5 reflects)
    splitSpread: 0.5, // rad between an outer fork and the (dropped) center
    rangeShrink: 0.62, // each reflection reaches 62% as far as its parent
    widthShrink: 0.8, // ...and is 80% as thick (the beam "gets smaller")
    duration: 1.0, // beam stays ON for 1000ms (longer than the base 300ms blast)
    damageMult: 0.5, // ...but hits softer per tick to offset the longer uptime
  },
} as const;
