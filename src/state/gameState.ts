// The single mutable world. One object owns everything; systems mutate it; views
// only read it. A view can be destroyed and rebuilt from this state at any frame.
//
// Phase 0 establishes the *shape* only — flat entity arrays, the player
// placeholder, the spatial hash. Phase 1 fills these with behavior.

import { Rng } from "../core/rng";
import { SpatialHash } from "../core/spatialHash";
import { Enemies } from "./enemies";
import { Projectiles, PROJECTILE_CAPACITY } from "./projectiles";
import { DamageNumbers, DAMAGE_NUMBER_CAPACITY } from "./damageNumbers";
import { WhipStrikes, WHIP_STRIKE_CAPACITY } from "./whipStrikes";
import { Gems } from "./gems";
import type { WeaponState } from "./weapons";
import { createWeaponState } from "./weapons";
import { ENEMY } from "../data/enemies";
import { PLAYER } from "../data/player";
import { XP, xpToNext } from "../data/xp";

// Internal world dimensions. Gameplay math is always in these coordinates; the
// renderer letterboxes them to the actual viewport.
export const WORLD_W = 1920;
export const WORLD_H = 1080;

// 2x the enemy collision radius is a reasonable starting cell size
// (see docs/03-spatial-hash.md). Tunable; profile once enemies exist.
const HASH_CELL_SIZE = ENEMY.baseRadius * 2;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Boss {
  active: boolean;
  pos: Vec2;
  hp: number;
  maxHp: number;
  hitTimer: number; // hit-flash, like the swarm
  projHitUntil: number; // sim-time gate between projectile hits
  garlicNextHit: number; // sim-time gate between garlic ticks
  laserNextHit: number; // sim-time gate between laser-beam ticks
}

export interface Player {
  pos: Vec2;
  speed: number; // px/sec
  radius: number;
  hp: number;
  maxHp: number;
  invuln: number; // seconds of remaining i-frames after a hit (0 = vulnerable)
  xp: number; // XP banked toward the next level
  level: number;
  xpToNext: number; // XP needed to go from `level` to the next
  pickupRadius: number; // gem collect distance (px)
  magnetRadius: number; // gem homing distance (px)
  facingX: number; // unit heading from the last movement input (drives the laser aim)
  facingY: number; // updated only while moving; holds its last value when idle
}

// Global passive multipliers — upgrades that buff *every* weapon at once rather
// than one weapon's stats. Each starts at 1.0 (a no-op multiplier) and is grown
// by its level-up upgrade. Weapons fold these in at the source so the effect is
// uniform: damage at each spawn/hit, fire rate at each cooldown re-arm, AoE on the
// area weapon(s). Stored as plain numbers — no per-frame allocation to read them.
export interface Passives {
  damageMult: number; // scales every weapon's damage (1.0 = unchanged)
  fireRateMult: number; // scales firing speed; effective cooldown is divided by it
  aoeMult: number; // scales area-of-effect size (currently the Garlic aura)
}

export interface GameState {
  rng: Rng;
  time: number; // accumulated sim seconds (the survival timer)
  tick: number; // total logic ticks elapsed
  kills: number; // enemies killed this run
  player: Player;
  hash: SpatialHash;
  enemies: Enemies;
  projectiles: Projectiles;
  damageNumbers: DamageNumbers;
  daggerTimer: number; // seconds until the Dagger may fire again
  whipTimer: number; // seconds until the Whip may swing again
  axeTimer: number; // seconds until the Axe may throw again
  laserTimer: number; // seconds until the Laser may fire again
  laserActive: number; // seconds the beam stays ON this blast (0 = beam off)
  laserDirX: number; // beam heading, locked from player facing at trigger time
  laserDirY: number;
  whipStrikes: WhipStrikes; // lingering swing visuals
  gems: Gems; // XP drops
  weapons: WeaponState; // mutable per-run weapon stats (upgrades modify these)
  passives: Passives; // global multipliers spanning all weapons (upgrades modify these)
  levelUpTimer: number; // seconds remaining on the level-up flash (0 = idle)
  levelUpsPending: number; // level-ups awaiting an upgrade choice; >0 pauses the sim
  levelingEnabled: boolean; // debug: when false, XP grants no levels (toggle with K)
  boss: Boss; // the 10-minute finale (inactive until then)
  won: boolean; // boss defeated; the sim freezes on the victory screen
  gameOver: boolean; // player HP hit 0; the sim freezes until restart
  godMode: boolean; // debug: ignore contact damage (toggle with L)
}

export function createGameState(seed: number): GameState {
  return {
    rng: new Rng(seed),
    time: 0,
    tick: 0,
    kills: 0,
    player: {
      pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
      speed: PLAYER.speed,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      invuln: 0,
      xp: 0,
      level: 1,
      xpToNext: xpToNext(1),
      pickupRadius: XP.pickupRadius,
      magnetRadius: XP.magnetRadius,
      facingX: 1, // default heading: facing right until the first move input
      facingY: 0,
    },
    hash: new SpatialHash(HASH_CELL_SIZE, WORLD_W, WORLD_H, ENEMY.capacity),
    enemies: new Enemies(ENEMY.capacity),
    projectiles: new Projectiles(PROJECTILE_CAPACITY),
    damageNumbers: new DamageNumbers(DAMAGE_NUMBER_CAPACITY),
    daggerTimer: 0,
    whipTimer: 0,
    axeTimer: 0,
    laserTimer: 0,
    laserActive: 0,
    laserDirX: 1,
    laserDirY: 0,
    whipStrikes: new WhipStrikes(WHIP_STRIKE_CAPACITY),
    gems: new Gems(XP.capacity),
    weapons: createWeaponState(),
    // Fresh object on each createGameState → restart resets every passive to 1.0.
    passives: { damageMult: 1, fireRateMult: 1, aoeMult: 1 },
    levelUpTimer: 0,
    levelUpsPending: 0,
    levelingEnabled: true,
    boss: {
      active: false,
      pos: { x: 0, y: 0 },
      hp: 0,
      maxHp: 0,
      hitTimer: 0,
      projHitUntil: 0,
      garlicNextHit: 0,
      laserNextHit: 0,
    },
    won: false,
    gameOver: false,
    godMode: false,
  };
}
