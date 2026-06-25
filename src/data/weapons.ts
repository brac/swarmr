// Weapon tunables. Systems read these numbers and hardcode nothing.
// See docs/02-dagger.md.

export const DAGGER = {
  cooldown: 0.5, // seconds between fires
  damage: 14,
  projectileSpeed: 800, // px/sec
  projectileLifetime: 3, // seconds — long enough to fly all the way off-screen
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

// Whip — now a melee SWORD (no projectile). It only swings when an enemy is within
// striking range; each swing cleaves every enemy in a forward arc around the player
// (area overlap, not a moving entity), instantaneous, so no per-enemy re-hit
// bookkeeping (that lesson is Garlic's). The blade sprite swings back and forth fast
// while active — a renderer animation driven by `swingFreq`/`swingArc`.
export const WHIP = {
  cooldown: 0.45, // seconds between damage swings (fast)
  damage: 20,
  range: 130, // strike radius (px) — melee; the sword only swings within this
  arcHalfAngle: 1.4, // forward half-arc the damage covers (rad) → ~80° each way
  back: 24, // small coverage behind the player so point-blank mobs are caught
  swingArc: 1.0, // visual: ± blade rotation around its rest angle (rad); one sweep per swing
  // Flurry (evolution) — same proximity sword, swinging ~2× faster with greater reach.
  evo: {
    cooldown: 0.22, // ~2× faster swings
    range: 170, // bigger reach (px) than the base 130
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
  // Side-scroller: axes arc FORWARD (rightward) across the lane on a flat
  // trajectory — high x-speed, a small upward kick, and gentle gravity so the
  // parabola stays shallow and the axe travels most of the screen width.
  gravity: 280, // downward accel (px/s²) → a shallow arc
  launchSpeedY: 180, // small upward kick (px/s) — keeps the arc flat
  launchSpeedX: 720, // forward (rightward) speed (px/s) — carries it across the screen
  spinRate: 14, // visual tumble (rad/s)
  lifetime: 3.5, // backstop despawn (s); normally it leaves the right edge first
  count: 1, // axes per throw
  // Cyclone (evolution) — gravity off; each throw flings TWO big, heavy-hitting
  // axes FORWARD (rightward, like the base lob) with a little angle variation —
  // no rotating spawner, nothing thrown behind. Infinite pierce + the damage
  // multiplier lets them cleave straight through the swarm. See docs/05.
  evo: {
    count: 2, // axes per throw, fanned around the forward heading
    speed: 600, // forward px/s (gravity off — straight lines)
    cooldown: 0.5, // s between throws
    radiusMult: 2, // axes are 100% bigger (unchanged)
    damageMult: 4, // hits far harder than the base lob — cleaves through mobs
    spread: 0.22, // rad — the fan between the two forward axes
    jitter: 0.1, // rad — small random angle variation per throw
  },
} as const;

// Garlic — now "Piercing Light": a single fast ray fired from the player at 45° up
// or down, aimed toward the nearest enemy (snapped to the nearer diagonal). It rides
// the projectile pool (kind PROJ_LIGHT, infinite pierce — like the Axe) and REFLECTS
// off the top/bottom world edges up to `maxReflections` times before it stops
// bouncing, then leaves the map. Piercing: it damages every enemy it crosses, gated
// only by the shared per-enemy projectile re-hit cooldown.
//
// `radius` is the ray's hitbox half-thickness; the upgradeable `garlic.radius` stat
// and the AoE passive scale it (a fatter beam). `damage` is per pierce hit.
export const GARLIC = {
  cooldown: 0.8, // seconds between rays
  damage: 10, // per pierce hit
  speed: 1440, // px/s — ~2× the axe's 720 forward speed
  radius: 13, // ray hitbox half-thickness (px) — skinny; garlic.radius stat + AoE passive scale it
  lifetime: 4.0, // backstop despawn (s); normally exits the map first
  maxReflections: 5, // bounces off top/bottom before it stops reflecting
  angle: Math.PI / 4, // 45° up/down lean; the horizontal component is always forward
  // Refraction (evolution) — fires BOTH the up and down ray each shot, with more
  // bounces, on a slightly faster cadence. Read at fire time from `evolved` + evo.
  evo: {
    dual: true, // fire the up AND down ray together
    extraReflections: 3, // → 8 total bounces
    cooldownMult: 0.7, // fires a bit faster
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
