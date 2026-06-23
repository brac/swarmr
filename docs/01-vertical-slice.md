# 01 — Vertical Slice

The smallest thing that proves swarmr works. When this is done and holds frame budget at 2,000+ enemies, the rest of the game is content and variations on systems already built.

## Scope (exactly this, nothing more)

- **Player:** WASD movement, a sprite, a position. No health bar yet, no leveling. Just moves.
- **One enemy type:** spawns at screen edge, flocks toward the player at a fixed speed. Has HP and a collision radius. Dies when HP ≤ 0, returns to pool.
- **Spatial hash:** uniform grid. Enemies register their cell each tick. Weapons and collision query it. Built now, not later.
- **Dagger weapon:** auto-fires on a cooldown toward the nearest enemy (queried via the hash). Spawns a pooled projectile that travels, hits, deals damage, returns to pool.
- **Collision:** projectile↔enemy via the spatial hash. On hit: apply damage, spawn damage number, free the projectile.
- **Damage numbers:** pooled, bitmap-font, float up and fade, return to pool.
- **Map:** flat ground, a handful of static rectangle colliders the player and enemies route around (or just collide with — routing can be dumb at first).

## Explicitly out of scope for the slice

Leveling, XP gems, weapon upgrades, multiple enemy types, waves, menus, audio, art polish, the other three weapons. All of it waits.

## Definition of done

1. 2,000 enemies on screen.
2. Logic tick ≤ 4ms, render ≤ 8ms at that count.
3. Allocation profiler shows a flat line during steady-state play (no sawtooth = pooling works).
4. Dagger auto-targeting feels responsive — projectiles go where the threat is.
5. Damage numbers pop and read clearly at swarm density.

If all five hold, the "wow, look at that swarm" moment is guaranteed and you've earned the right to add weapon two.

## Build sequence within the slice

1. Pixi app + fixed-timestep loop + letterboxed 1920×1080. Empty stage. (`core/loop.ts`, `main.ts`)
2. `mulberry32` RNG. (`core/rng.ts`)
3. Player: sprite + WASD. Reads input, mutates `GameState.player.pos`. (`state/gameState.ts`, `systems/movement.ts`)
4. Generic object pool. (`core/pool.ts`)
5. Spatial hash. (`core/spatialHash.ts` — see `docs/03-spatial-hash.md`)
6. One enemy: pooled, spawns at edge, flocks to player, registers in hash each tick. (`systems/spawn.ts`, `systems/movement.ts`)
7. Crank the spawner to 2,000 with NO weapon. Confirm movement + hash hold frame budget. **This is the first real checkpoint** — if 2,000 dumb enemies don't render at budget, fix that before adding combat.
8. Dagger. (`systems/weapons/dagger.ts` — see `docs/02-dagger.md`)
9. Collision. (`systems/collision.ts`)
10. Damage numbers. (`systems/damageNumbers.ts`)
11. Re-confirm the budget with combat live. Tune.

Checkpoint 7 is the one people skip and regret. Hit your entity count with dumb enemies first, so when combat is slow you know it's the weapon code, not the renderer.
