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
import { ENEMY } from "../data/enemies";
import { PLAYER } from "../data/player";

// Internal world dimensions. Gameplay math is always in these coordinates; the
// renderer letterboxes them to the actual viewport.
export const WORLD_W = 1920;
export const WORLD_H = 1080;

// 2x the enemy collision radius is a reasonable starting cell size
// (see docs/03-spatial-hash.md). Tunable; profile once enemies exist.
const HASH_CELL_SIZE = ENEMY.radius * 2;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Player {
  pos: Vec2;
  speed: number; // px/sec
  radius: number;
  hp: number;
  maxHp: number;
  invuln: number; // seconds of remaining i-frames after a hit (0 = vulnerable)
}

export interface GameState {
  rng: Rng;
  time: number; // accumulated sim seconds
  tick: number; // total logic ticks elapsed
  player: Player;
  hash: SpatialHash;
  enemies: Enemies;
  projectiles: Projectiles;
  damageNumbers: DamageNumbers;
  daggerTimer: number; // seconds until the Dagger may fire again
  whipTimer: number; // seconds until the Whip may swing again
  whipStrikes: WhipStrikes; // lingering swing visuals
  gameOver: boolean; // player HP hit 0; the sim freezes until restart
}

export function createGameState(seed: number): GameState {
  return {
    rng: new Rng(seed),
    time: 0,
    tick: 0,
    player: {
      pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
      speed: PLAYER.speed,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      invuln: 0,
    },
    hash: new SpatialHash(HASH_CELL_SIZE, WORLD_W, WORLD_H, ENEMY.capacity),
    enemies: new Enemies(ENEMY.capacity),
    projectiles: new Projectiles(PROJECTILE_CAPACITY),
    damageNumbers: new DamageNumbers(DAMAGE_NUMBER_CAPACITY),
    daggerTimer: 0,
    whipTimer: 0,
    whipStrikes: new WhipStrikes(WHIP_STRIKE_CAPACITY),
    gameOver: false,
  };
}
