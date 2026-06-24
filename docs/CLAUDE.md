# swarmr — CLAUDE.md

> **Side-scrolling bullet heaven** (auto-attack horde survival, played as a side-scroller). Web. PixiJS v8. The genre is light on rendering and heavy on entity throughput — treat it as a systems problem, not a graphics problem.

## Current direction — side-scroller pivot

swarmr began as a top-down arena survivor and has since pivoted to a **side-scrolling bullet heaven**: the player rides the left, the swarm streams in **straight from the right**, weapons fire **downrange (facing locked right)**, and the floor scrolls to imply forward travel. The systems backbone (pools, hash, fixed timestep) is unchanged — only the spawn geometry, enemy movement, and framing moved.

What changed from the original top-down build:
- **Spawn:** enemies enter only from the right edge; off-left-edge movers are culled.
- **Movement:** per-enemy `MOVE_*` behavior — all spawn `STRAIGHT_LEFT`; the original `HOMING` seek is kept for future movement types.
- **Weapons (5):** added **Laser** (sustained line-segment beam), and every weapon now **evolves** at its 5th upgrade pick (see `docs/05-weapon-evolutions.md`). **Garlic, Axe, and Whip are flagged for a side-scroller redesign** (they were designed for a top-down swarm — see `BACKLOG.md`).
- **Swarm cap:** north-star count raised 2,000 → **2,500**.
- **Dev menu** (backtick): set any weapon to base/+1/max/evolved and a live spawn-count slider.

The sections below are the original (top-down) design intent and build history; treat the pivot notes above and the inline "as-built" notes as current.

## North star

Get **2,000+ enemies on screen at frame budget** with the Dagger loop feeling good *before* adding a second weapon. Prove the swarm, then prove the fun, then expand. Do not build content on top of a backbone that hasn't hit the entity-count target.

## Status — shipped ✅

swarmr is a complete, winnable, deployed game: **https://brac.github.io/swarmr/**

The north star held — 2,000 enemies at frame budget with a flat heap throughout (logic ~1–2ms, render <1ms). Built well past the original slice:

- **Weapons (5):** Dagger, Whip, Garlic, **Axe**, **Laser**. The Axe (a gravity projectile lobbed up that arcs back through the swarm with infinite pierce) replaced the planned **Holy Water** as weapon 4 — same "each weapon forces a new system" rationale, swapped by the designer mid-build. The **Laser** (weapon 5) forced a line-segment hitbox. Each weapon **evolves** at its 5th upgrade pick (`docs/05`). Holy Water (lobbed delayed-AOE) is the one planned weapon not built; clean future addition.
- **Stakes:** player HP, i-frame contact damage, death + restart.
- **Progression:** XP gems → leveling → a pause-and-choose upgrade menu (12 upgrades that mutate per-run `state.weapons` / `state.player`).
- **Variety + ramp:** 3 enemy types (grunt / runner / tank) phased in over time; enemy HP scales with elapsed time.
- **Ending:** a 10-minute survival goal with a boss finale + victory screen.
- **Presentation:** juice (hit flash → scale-punch, crits, ±variance), Howler audio (synthesized SFX), title + pause screens, and a pixel-art sprite pass over the grey-box.
- **Deploy:** GitHub Pages via Actions on push to `main` (Vite `base: '/swarmr/'`).

The sections below are the original design intent; where reality diverged it's noted inline.

## Tech stack

- **Renderer:** PixiJS v8 — pinned to **WebGL** (`preference: "webgl"`; WebGPU + the experimental `ParticleContainer` was unverified). No engine. No Godot.
- **Language:** TypeScript, strict.
- **Build:** Vite 6.
- **Audio:** Howler.js (deferred until after the slice; ✅ done — synthesized SFX via `scripts/gen-sounds.mjs`).
- **Deploy:** ✅ GitHub Pages via `.github/workflows/deploy.yml` (auto-deploys on push to `main`). Static `dist/` — also hostable on Cloudflare Pages / any static server.

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
3. **Batch the draw.** One texture atlas. `ParticleContainer` for the swarm (one per enemy type — single texture each — routed by type). Damage numbers: **pooled digit sprites** composed from a pre-rendered digit atlas. ⚠️ The original plan said "bitmap font, never `Text`" — but **`BitmapText` *also* allocates**: setting `.text` re-runs `getBitmapTextLayout()` (a fresh layout object + arrays) every change, which sawtooths the heap at swarm throughput. Digit sprites have zero per-change allocation. See `docs/04-pooling-rendering.md`.

## Build order (do not reorder)

Each weapon is added because it forces a *new system* to exist. The order is the lesson plan.

1. ✅ **Vertical slice:** Player + one flocking enemy type + spatial hash + Dagger (pooled projectiles) + collision + pooled damage numbers. (Static-collider map skipped — low value, doesn't force a new system.) See `docs/01-vertical-slice.md`.
2. ✅ **Dagger** — nearest-target projectile. Builds the entire combat backbone: pool, spatial query, collision, damage number. See `docs/02-dagger.md`.
3. ✅ **Whip** — fixed-arc hitbox, no projectile. Forces a non-projectile area-overlap damage source. Cheap once Dagger collision exists.
4. ✅ **Garlic** — persistent player aura. Forces a per-enemy re-hit cooldown (absolute next-eligible timestamp per enemy — no per-tick decrement pass). The "damage cooldown per entity" pattern, reused by the boss's per-source gates.
5. ✅ **Axe** (replaced Holy Water) — a **gravity projectile**: rides the existing projectile pool with a per-projectile `gravity` term + `kind` tag, launched up, arcs through the swarm with infinite pierce. A per-enemy projectile re-hit gate stops a dwelling axe from melting one body.
6. ⬜ **Holy Water** (not built) — lobbed delayed-AOE. The remaining planned weapon.

Gate: weapon N+1 does not start until weapon N feels good and the entity-count target still holds. (Held throughout.)

### Post-weapon phases (all ✅)

Progression (XP gems → leveling → upgrades) · enemy variety + time-based difficulty ramp · 10-minute boss + win condition · audio · title/pause screens · sprite art pass · GitHub Pages deploy. Each was its own commit ("Phase N …" in the git log).

## Performance budget

- Logic tick: ≤ 4ms at 2,000 enemies.
- Render: ≤ 8ms at 2,000 enemies.
- Zero allocations in the per-frame hot path (verify with the allocation profiler — flat sawtooth = failure).
- If the main thread chokes past ~2,000 entities, move collision broadphase to a Web Worker. Not before — don't pay the serialization cost until you've measured the need.

## Directory layout

As-built (the spec's plan, grown):

```
swarmr/
  src/
    main.ts            # bootstrap, loop, app lifecycle (title/pause/restart), keybinds
    core/
      loop.ts          # fixed-timestep accumulator
      rng.ts           # mulberry32
      spatialHash.ts   # uniform-grid broadphase (flat counting sort)
      input.ts         # keyboard
      audio.ts         # Howler observer — plays SFX on GameState edges
      pool.ts          # generic pool (entities use SoA pools instead)
    state/             # the world: gameState + SoA pools
      gameState.ts  enemies.ts  projectiles.ts  gems.ts  damageNumbers.ts
      whipStrikes.ts  tendrils.ts  weapons.ts (mutable per-run stats)
    systems/           # pure update logic
      movement.ts  spawn.ts  broadphase.ts  contactDamage.ts  collision.ts
      combat.ts (rollHit)  targeting.ts  gems.ts  upgrades.ts  boss.ts
      damageNumbers.ts  projectiles.ts
      weapons/         dagger.ts  whip.ts  garlic.ts  axe.ts  laser.ts
    views/             # dumb — read GameState, draw
      renderer.ts (Pixi)  hud.ts (DOM)  upgradeMenu.ts  devMenu.ts  perfOverlay.ts
    data/              # ALL tunables
      weapons.ts  enemies.ts  waves.ts  xp.ts  boss.ts  player.ts  combat.ts
    vite-env.d.ts
  public/
    sounds/*.wav       # synthesized SFX (gen-sounds.mjs output)
    assets/            # Kenney-style sprite atlas (tilemap_packed.png + tiles)
  scripts/gen-sounds.mjs
  .github/workflows/deploy.yml
  docs/  README.md  vite.config.ts
```

## Naming

Lowercase project name (`swarmr`), consistent with burnRat / herdr / bracSprite.

## What NOT to do

- Don't add a second weapon before the slice hits target.
- Don't use `Text` **or per-change `BitmapText`** for damage numbers — both allocate per object/change. Compose from pooled digit sprites.
- Don't set `particle.tint` on the swarm each frame — its setter allocates (`Color.shared.setValue`). Write `particle.color` directly with bit-packed BGRA. (And `scale` lives in the static `vertex` buffer, `tint` in `color` — enable them in `dynamicProperties` to animate.)
- Don't `new` anything in the loop. Reset scratch arrays with `length = 0`; avoid `for…of` in hot paths (iterator alloc).
- Don't write naive collision "just to start."
- Don't put a too-big entity (the boss) in the uniform hash — it's bigger than a cell and breaks grid queries. Handle it outside the pool with direct overlap checks.
- Don't reach for Godot. The genre doesn't need it and you'd lose your whole Pixi architecture investment.
- Don't add juice/art/audio until the swarm holds frame budget. Prove it grey-box first. (Done in that order.)
- Don't run `npm run dev` — the designer runs the dev server. Commit/push only when asked.
