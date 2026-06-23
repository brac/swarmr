// The single mutable world. One object owns everything; systems mutate it; views
// only read it. A view can be destroyed and rebuilt from this state at any frame.
//
// Phase 0 establishes the *shape* only — flat entity arrays, the player
// placeholder, the spatial hash. Phase 1 fills these with behavior.

import { Rng } from "../core/rng";
import { SpatialHash } from "../core/spatialHash";

// Internal world dimensions. Gameplay math is always in these coordinates; the
// renderer letterboxes them to the actual viewport.
export const WORLD_W = 1920;
export const WORLD_H = 1080;

// 2x the planned enemy collision radius is a reasonable starting cell size
// (see docs/03-spatial-hash.md). Tunable; profile once enemies exist.
const ENEMY_RADIUS = 12;
const HASH_CELL_SIZE = ENEMY_RADIUS * 2;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Player {
  pos: Vec2;
  speed: number; // px/sec
  radius: number;
}

export interface GameState {
  rng: Rng;
  time: number; // accumulated sim seconds
  tick: number; // total logic ticks elapsed
  player: Player;
  hash: SpatialHash;
  // Flat entity arrays land here in Phase 1 (enemies, projectiles, damage nums).
}

export function createGameState(seed: number): GameState {
  return {
    rng: new Rng(seed),
    time: 0,
    tick: 0,
    player: {
      pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
      speed: 300,
      radius: 16,
    },
    hash: new SpatialHash(HASH_CELL_SIZE),
  };
}
