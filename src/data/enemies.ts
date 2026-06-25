// Enemy tunables. `ENEMY` holds stats shared by ALL enemies (the swarm renders
// as one batch, so separation, hit-react, the hash cell size and the particle
// texture are uniform). `ENEMY_TYPES` holds the per-type stats set on each enemy
// at spawn — the variety. Code reads these; no magic numbers in systems.

// Per-enemy movement behavior. Lives here (with the type data) so a type can
// declare how it moves; state/enemies re-exports these for the movement system.
export const MOVE_STRAIGHT_LEFT = 0; // drift straight right-to-left at own speed
export const MOVE_HOMING = 1; // seek the player (used by the late-game elites)

export interface EnemyType {
  radius: number; // collision radius (px)
  speed: number; // px/sec (downrange for STRAIGHT_LEFT, toward the player for HOMING)
  hp: number; // base HP (scaled up over the run by difficulty)
  contactDamage: number; // damage dealt to the player on touch (per i-frame window)
  color: number; // base tint; the hit-flash lerps off it
  xp: number; // XP dropped on death
  move?: number; // MOVE_* behavior (default MOVE_STRAIGHT_LEFT)
}

// Index = type id used by the spawner and stored per enemy. The renderer maps the
// same index to an atlas sprite (T_ENEMY), and the difficulty tiers (waves.ts)
// weight spawns by this index — so the ordering here is load-bearing; append, do
// not reorder. Base HP is set so NO level-1 weapon one-shots a level-1 mob: the
// strongest base hit is the Axe/Laser at 26 (×1.15 max variance ≈ 30), and the
// frailest mob (Runner) has 40 HP, so it always takes ≥2 strikes. HP then scales
// up over the run (DIFFICULTY.hpRampPerMin) until the same mob needs several
// heavily-upgraded weapons at once to drop.
//
// Difficulty arc: 0-2 are the original early/mid bodies; 3-5 widen the mid-game
// roster; 6-7 are the apex elites — fast, tanky, and HOMING (they cut toward the
// player instead of streaming straight) — gated to 7:00 by the spawn tiers.
export const ENEMY_TYPES: EnemyType[] = [
  // 0 — Grunt: the baseline swarm body.
  { radius: 12, speed: 90, hp: 65, contactDamage: 10, color: 0xff5566, xp: 1 },
  // 1 — Runner: fast and fragile, gets in your face.
  { radius: 10, speed: 168, hp: 40, contactDamage: 8, color: 0xffb347, xp: 1 },
  // 2 — Tank: slow, big, heavy hitter, worth more XP.
  { radius: 19, speed: 55, hp: 240, contactDamage: 20, color: 0xb060e0, xp: 3 },
  // 3 — Goblin: a quick, lightly-built pack mob — faster than a grunt, a touch
  //     frailer, swarms in numbers to pressure the lane.
  { radius: 11, speed: 120, hp: 60, contactDamage: 9, color: 0x7ec850, xp: 1 },
  // 4 — Biter (crab): an armored mid-game bruiser — moderate speed, soaks more
  //     than a grunt and bites harder.
  { radius: 14, speed: 82, hp: 135, contactDamage: 14, color: 0xe05a4a, xp: 2 },
  // 5 — Carapace (beetle): a slow, heavily-shelled HP sponge. Barely a threat by
  //     itself, but its bulk clogs the lane and eats burst.
  { radius: 16, speed: 46, hp: 330, contactDamage: 15, color: 0x9aa0a8, xp: 3 },
  // 6 — Hellhound: APEX elite. Fast AND tanky AND a heavy hitter, and it HOMES on
  //     the player rather than streaming straight. The 7:00 spike. High XP payout.
  { radius: 13, speed: 176, hp: 210, contactDamage: 22, color: 0x8a3df0, xp: 5, move: MOVE_HOMING },
  // 7 — Serpent: a fast HOMING assassin — frailer than the hellhound but the
  //     hardest single hit in the roster. Punishes a player who stops dodging.
  { radius: 12, speed: 150, hp: 150, contactDamage: 26, color: 0xd0b25a, xp: 4, move: MOVE_HOMING },
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
