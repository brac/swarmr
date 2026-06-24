# swarmr

### ▶ [Play it now](https://brac.github.io/swarmr/)

A browser-based **side-scrolling bullet heaven** — ride the left flank while a swarm of up to 2,500 enemies streams in from the right, auto-fire five weapons, level up (each weapon evolves at max), and survive ten minutes to face the boss. Built with PixiJS v8 and TypeScript; no game engine.

The genre is light on rendering and heavy on entity throughput, so swarmr is built as a **systems problem, not a graphics problem**: a fixed-timestep simulation over structure-of-arrays entity pools, a uniform-grid spatial hash, and zero per-frame allocation in the hot path. It holds **2,000+ enemies at frame budget** (≈2 ms logic / <1 ms render) with a flat heap.

## Play

**[brac.github.io/swarmr](https://brac.github.io/swarmr/)** — runs in any modern browser, no install.

1. **Move** with `WASD` or the arrow keys — you hold the left side as the world scrolls past; that's the only control, and every weapon auto-fires downrange to the right.
2. **Collect** the cyan XP gems enemies drop (they magnet toward you).
3. **Level up** → pick one of three upgrades to shape your build. A weapon's 5th pick **evolves** it into a powered-up form (gold card).
4. **Survive to 10:00**, then defeat the boss (it advances from the right too) to win.

Enemies stream in from the right and get tougher over time: fast **runners** phase in around 0:25, heavy **tanks** around 1:15, and every enemy gains HP as the clock climbs.

### Controls

| Key | Action |
|-----|--------|
| `WASD` / arrows | Move |
| `Esc` | Pause / resume |
| `1` `2` `3` | Choose an upgrade (on level-up) |
| `R` | Restart (after death / victory) |
| `M` | Mute / unmute |

### Debug keys

| Key | Action |
|-----|--------|
| `` ` `` | Open the dev menu (set any weapon to base/+1/max/evolved, spawn-count slider) |
| `L` | Toggle god mode (ignore contact damage) |
| `K` | Toggle XP leveling (freeze the upgrade flow) |
| `]` / `[` | Manual level up (opens the menu) / level down |
| `B` | Spawn the boss immediately |

## Weapons

Each weapon was added because it forces a *new system* to exist:

- **Dagger** — auto-fires at the nearest enemy. Pooled projectiles + spatial-hash targeting + collision. Upgrades fan out multiple.
- **Whip** — a fixed-arc melee cleave. Non-projectile, area-overlap damage.
- **Garlic** — a persistent aura. Per-enemy re-hit cooldown (the DoT cadence pattern).
- **Axe** — a gravity projectile lobbed upward that arcs down through the swarm with infinite pierce.
- **Laser** — a sustained beam fired downrange along your (locked-right) facing. A line-segment hitbox that pierces everything in the lane.

At its 5th upgrade each weapon **evolves**: the Dagger becomes a fast triple-stream, the Whip a front/back cleave, Garlic a searing tendril-flicking aura, the Axe an outward spiral of giant blades, and the Laser a reflecting beam that splits and shrinks across the swarm.

Hits roll ±15% damage variance and a 15% / 2× crit (crits render larger and red).

## Tech stack

- **Renderer:** [PixiJS v8](https://pixijs.com) (WebGL), batched `ParticleContainer`s for the swarm/projectiles/gems
- **Audio:** [Howler.js](https://howlerjs.com) with procedurally-synthesized SFX
- **Language:** TypeScript (strict)
- **Build:** [Vite 6](https://vite.dev)
- **No game engine, no physics library**

## Getting started

Requires **Node 20+**.

```bash
npm install
npm run dev        # start the dev server (Vite)
```

Open the printed local URL and press any key to begin.

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # type-check only
```

`dist/` is a fully static bundle — host it anywhere (Cloudflare Pages, GitHub Pages, any static server).

### Regenerating sound effects

The SFX in `public/sounds/` are synthesized (grey-box arcade beeps) by a script. They're committed, so you don't need to run this — but to tweak them:

```bash
node scripts/gen-sounds.mjs
```

Drop real audio files over the same filenames to replace them.

## Architecture

A single mutable `GameState` owns the whole world. Pure **systems** read input and mutate it on a fixed timestep; dumb **views** read it and draw. Any view can be destroyed and rebuilt from state on any frame.

- **Fixed-timestep loop** — 240 Hz logic decoupled from render via an accumulator; gameplay never reads wall-clock delta.
- **Seeded PRNG** (`mulberry32`) — every random call goes through it, so runs are reproducible for debugging.
- **Entities as structure-of-arrays** over typed arrays — the array *is* the pool: capacity pre-allocated once, active set packed in `[0, count)`, death is an O(1) swap-remove. No `new` in the loop.
- **Uniform-grid spatial hash** — a flat counting-sort grid rebuilt allocation-free each tick; powers weapon targeting, separation, and collision.
- **Zero per-frame allocation** in the hot path. Damage numbers, for instance, are composed from pooled digit sprites (no `BitmapText` re-layout) so they never churn the heap regardless of how many are on screen.
- **All tunables in `src/data/`** — weapon stats, enemy types, the difficulty curve, XP/level math, the boss. Code reads data; you edit data.

### Project layout

```
src/
  main.ts            # bootstrap: state, views, loop, lifecycle (title/pause/restart)
  core/
    loop.ts          # fixed-timestep accumulator
    rng.ts           # mulberry32
    spatialHash.ts   # uniform-grid broadphase
    input.ts         # keyboard
    audio.ts         # Howler observer (plays on state edges)
  state/             # the world: gameState + SoA entity pools (enemies, projectiles, gems, …)
  systems/           # pure update logic: movement, spawn, collision, weapons/, gems, boss, upgrades
  views/             # renderer (Pixi), hud (DOM), upgradeMenu, devMenu, perfOverlay
  data/              # all tunables (weapons, enemies, waves, xp, boss, player, combat)
scripts/
  gen-sounds.mjs     # synthesizes public/sounds/*.wav
```

## Performance

Targets, held at the 2,000-enemy count:

- Logic tick ≤ 4 ms — currently ~1–2 ms
- Render ≤ 8 ms — currently <1 ms
- Flat allocation profile during steady-state play (verify with the browser's heap timeline)

A live overlay (top-left) shows fps, logic/render ms, tick count, and enemy count.

## License

Private project, unlicensed. Ask before reusing.
