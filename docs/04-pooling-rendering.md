# 04 — Pooling & Rendering

The two things that decide whether the swarm survives contact with the garbage collector and the GPU. Get these wrong and you cap out around a few hundred enemies; get them right and 2,000+ is comfortable.

## Object pooling

Anything that spawns in bulk and dies fast must come from a pool: projectiles, enemies, XP gems, damage numbers. Zero `new` in the hot path.

### Generic pool shape (`core/pool.ts`)

```ts
export class Pool<T> {
  private free: T[] = [];
  private factory: () => T;
  constructor(factory: () => T, prealloc: number) {
    this.factory = factory;
    for (let i = 0; i < prealloc; i++) this.free.push(factory());
  }
  acquire(): T {
    return this.free.pop() ?? this.factory(); // grows if exhausted, but size to avoid it
  }
  release(obj: T) {
    this.free.push(obj);
  }
}
```

### Rules

- **Pre-allocate to the expected peak.** If you'll have ~512 projectiles live, prealloc 512 so steady-state never calls the factory.
- **Reset state on acquire, not release** (or both) — never hand out a dirty object.
- **The pooled object's Pixi sprite is pooled too.** Don't destroy and recreate display objects; toggle `.visible` and reposition. Creating/destroying sprites mid-swarm is its own GC source.
- **Verify with the allocation profiler.** Steady-state play should show a flat line. A sawtooth means something is allocating per-frame — hunt it down. Common culprits: result arrays from queries, closures created in loops, `Text` objects, string concatenation for damage numbers.

## Rendering at swarm scale

### The enemy swarm

Use `ParticleContainer` (Pixi v8's high-throughput batched container) for the thousands of identical enemy sprites. It trades per-sprite flexibility (no per-child filters, limited transforms) for raw batched draw speed — exactly the right trade for a horde of identical mobs.

### One atlas

All gameplay sprites (player, enemy, projectile, gem) on a **single texture atlas**. Same base texture = one draw call batch. Multiple textures = a draw call break per texture swap, which is what actually kills Pixi performance — it's draw calls, not sprite count.

### Damage numbers — the classic trap

**Never use `PIXI.Text` for damage numbers.** Each `Text` allocates and uploads its own texture; at swarm hit-rates this both allocates per-frame and shatters batching.

Use a **bitmap font** (`BitmapText`). One font texture, GPU-batched glyphs, no per-number texture allocation. Pool the `BitmapText` objects like everything else.

### Letterboxing

Render the world at a fixed 1920×1080 internal resolution and scale-to-fit with letterbox bars. Gameplay math never depends on the actual window size — only the final scale transform does.

## The performance ladder (in order of impact)

1. Pool everything (kills GC pauses).
2. Single atlas (kills draw-call breaks).
3. `ParticleContainer` for the swarm (raw batch throughput).
4. `BitmapText` damage numbers (kills the per-text texture allocation).
5. Reused scratch arrays for spatial queries (kills per-query garbage).
6. *Only if still choking past ~2,000:* move collision broadphase to a Web Worker.

Work top-down. Most projects that "need a Worker" actually just had `Text` objects and a multi-texture atlas. Measure before you reach for threads.
