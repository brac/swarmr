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

// Index = type id used by the spawner and stored per enemy. Base HP is set so NO
// level-1 weapon one-shots a level-1 mob: the strongest base hit is the Axe/Laser
// at 26 (×1.15 max variance ≈ 30), and the frailest mob (Runner) has 40 HP, so it
// always takes ≥2 strikes. HP then scales up over the run (DIFFICULTY.hpRampPerMin)
// until the same mob needs several heavily-upgraded weapons at once to drop.
export const ENEMY_TYPES: EnemyType[] = [
  // 0 — Grunt: the baseline swarm body.
  { radius: 12, speed: 90, hp: 65, contactDamage: 10, color: 0xff5566, xp: 1 },
  // 1 — Runner: fast and fragile, gets in your face.
  { radius: 10, speed: 168, hp: 40, contactDamage: 8, color: 0xffb347, xp: 1 },
  // 2 — Tank: slow, big, heavy hitter, worth more XP.
  { radius: 19, speed: 55, hp: 240, contactDamage: 20, color: 0xb060e0, xp: 3 },
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
  // into a WIDE packed front — a curved arc of bodies — instead of collapsing
  // onto the player's exact point. Tuned to spread without overpowering the
  // seek: seek still wins overall, so the front stays glued to the player.
  sepRadius: 26, // start repelling within this distance (a touch past enemy diameter so the front loosens earlier; stays inside the hash's 3x3 search block so no neighbor is missed)
  sepStrength: 165, // push speed contribution (px/sec) at max closeness — enough lateral shove to fan mobs into a wider arc, below the level that would push them off the player
} as const;
