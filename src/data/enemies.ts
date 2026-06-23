// Enemy tunables. `ENEMY` holds stats shared by ALL enemies (the swarm renders
// as one batch, so separation, hit-react, the hash cell size and the particle
// texture are uniform). `ENEMY_TYPES` holds the per-type stats set on each enemy
// at spawn — the variety. Code reads these; no magic numbers in systems.

export interface EnemyType {
  radius: number; // collision radius (px)
  speed: number; // px/sec toward the player
  hp: number; // base HP (scaled up over the run by difficulty)
  contactDamage: number; // damage dealt to the player on touch (per i-frame window)
  color: number; // base tint; the hit-flash lerps off it
  xp: number; // XP dropped on death
}

// Index = type id used by the spawner and stored per enemy.
export const ENEMY_TYPES: EnemyType[] = [
  // 0 — Grunt: the baseline swarm body.
  { radius: 12, speed: 90, hp: 30, contactDamage: 10, color: 0xff5566, xp: 1 },
  // 1 — Runner: fast and fragile, gets in your face.
  { radius: 10, speed: 168, hp: 18, contactDamage: 8, color: 0xffb347, xp: 1 },
  // 2 — Tank: slow, big, heavy hitter, worth more XP.
  { radius: 19, speed: 55, hp: 120, contactDamage: 20, color: 0xb060e0, xp: 3 },
];

export const ENEMY = {
  capacity: 4096, // pre-allocated storage ceiling (> spawn target, leaves headroom)
  baseRadius: 12, // sizes the hash cell + the shared particle texture (= grunt radius)
  // Hit reaction (juice): on taking damage an enemy flashes toward hitFlashColor
  // and scale-punches, both decaying over hitReactTime. Pure visual — no gameplay.
  hitReactTime: 0.13, // seconds the flash + wobble lasts
  hitFlashColor: 0xffffff, // peak flash tint; decays back to the enemy's color
  hitWobble: 0.4, // extra scale at the moment of impact (1 → 1.4)
  // Separation (boids-style): push apart from neighbors so the swarm spreads
  // into a packed front instead of collapsing onto the player's exact point.
  sepRadius: 22, // start repelling within this distance (≈ enemy diameter)
  sepStrength: 130, // push speed contribution (px/sec) at max closeness
} as const;
