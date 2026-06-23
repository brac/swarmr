# swarmr — CLAUDE.md

> Bullet-hell survivors game. Web. PixiJS v8. The genre is light on rendering and heavy on entity throughput — treat it as a systems problem, not a graphics problem.

## North star

Get **2,000+ enemies on screen at frame budget** with the Dagger loop feeling good *before* adding a second weapon. Prove the swarm, then prove the fun, then expand. Do not build content on top of a backbone that hasn't hit the entity-count target.

## Tech stack

- **Renderer:** PixiJS v8 (WebGL, WebGPU when available). No engine. No Godot.
- **Language:** TypeScript, strict.
- **Build:** Vite.
- **Audio:** Howler.js (defer until after the slice works).
- **Deploy:** Cloudflare Pages or DigitalOcean + Caddy.

## Architecture (canonical — mirrors HyperBrick)

- **Seeded PRNG:** `mulberry32`. Every random call goes through it. No bare `Math.random()` anywhere in gameplay. Spawn positions, drops, crit rolls — all seeded so runs are reproducible for debugging.
- **Fixed-timestep loop:** accumulator pattern, 240Hz logic tick decoupled from render. Gameplay never reads wall-clock delta directly.
- **Resolution:** 1920×1080 internal, letterboxed to the viewport.
- **Single mutable `GameState`:** one object owns the whole world. Systems mutate it. No state scattered across view objects.
- **Dumb views:** Pixi display objects render `GameState`; they hold no gameplay logic and make no decisions. A view can be destroyed and rebuilt from state at any frame.
- **All tunables in `data/`:** weapon stats, enemy stats, spawn tables, wave config. Code reads data; designers (you) edit data. No magic numbers in systems.

## The three rules that decide whether the swarm works

These are not "later" optimizations. They are load-bearing from enemy #1.

1. **Spatial hash from day one.** Uniform grid broadphase. Naive O(n²) collision is forbidden even as a stopgap — the whole architecture (weapon targeting, enemy neighbor queries, collision) is shaped by how things query the grid. Stub it in with the first enemy. ~80 lines. This is the difference between 300 enemies and 5,000.
2. **Pool everything that spawns in bulk.** Projectiles, enemies, XP gems, damage numbers. Zero per-frame allocation in the hot path. GC pauses are the enemy of a swarm game. Acquire/release, never `new` in the loop.
3. **Batch the draw.** One texture atlas. `ParticleContainer` (or v8's optimized batched container) for the enemy swarm. Damage numbers via **bitmap font**, never `Text` objects — `Text` allocates a texture per object and will tank you at swarm scale.

## Build order (do not reorder)

Each weapon is added because it forces a *new system* to exist. The order is the lesson plan.

1. **Vertical slice (this doc's whole focus):** Player + one flocking enemy type + spatial hash + Dagger (pooled projectiles) + collision + pooled damage numbers + flat map with a few static colliders. See `docs/01-vertical-slice.md`.
2. **Dagger** — nearest/facing-target projectile. Builds the entire combat backbone: pool, spatial query, collision, damage number. See `docs/02-dagger.md`.
3. **Whip** — fixed-arc hitbox, no projectile. Forces a non-projectile area-overlap damage source. Cheap once Dagger collision exists.
4. **Garlic** — persistent player aura. Forces tick-based DoT cadence + per-enemy re-hit cooldown. This teaches the "damage cooldown per entity" pattern reused everywhere.
5. **Holy Water** — lobbed projectile that lands and leaves a timed ground AOE. Delayed projectile + spawned persistent zone. Most complex; last.

Gate: weapon N+1 does not start until weapon N feels good and the entity-count target still holds.

## Performance budget

- Logic tick: ≤ 4ms at 2,000 enemies.
- Render: ≤ 8ms at 2,000 enemies.
- Zero allocations in the per-frame hot path (verify with the allocation profiler — flat sawtooth = failure).
- If the main thread chokes past ~2,000 entities, move collision broadphase to a Web Worker. Not before — don't pay the serialization cost until you've measured the need.

## Directory layout

```
swarmr/
  src/
    main.ts            # bootstrap, Pixi app, loop
    core/
      loop.ts          # fixed-timestep accumulator
      rng.ts           # mulberry32
      pool.ts          # generic object pool
      spatialHash.ts   # uniform grid broadphase
    state/
      gameState.ts     # the single mutable world
    systems/
      movement.ts
      spawn.ts
      weapons/
        dagger.ts
      collision.ts
      damageNumbers.ts
    views/
      renderer.ts      # reads GameState, draws. dumb.
    data/
      weapons.ts       # tunables
      enemies.ts
      waves.ts
  docs/
    01-vertical-slice.md
    02-dagger.md
    03-spatial-hash.md
    04-pooling.md
```

## Naming

Lowercase project name (`swarmr`), consistent with burnRat / herdr / bracSprite.

## What NOT to do

- Don't add a second weapon before the slice hits target.
- Don't use `Text` for damage numbers.
- Don't `new` anything in the loop.
- Don't write naive collision "just to start."
- Don't reach for Godot. The genre doesn't need it and you'd lose your whole Pixi architecture investment.
- Don't add juice/art/audio until the swarm holds frame budget. Prove it grey-box first.
