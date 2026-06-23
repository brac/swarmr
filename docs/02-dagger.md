# 02 — Dagger

The first weapon, built first because it forces the entire combat backbone into existence: projectile pool, spatial query for targeting, collision, damage number. Once Dagger works, every other weapon is a variation.

## Behavior

- Auto-fires on a fixed cooldown (no aiming input).
- On fire: query the spatial hash for the **nearest enemy** to the player. Spawn a pooled projectile aimed at it.
- Projectile travels in a straight line at fixed speed, has a lifetime and a collision radius.
- On enemy hit: apply damage, spawn a damage number, return projectile to pool.
- On lifetime expiry or off-screen: return projectile to pool.
- "Pierce" count optional (how many enemies one dagger passes through) — start at 1, it's a one-line data tunable later.

## Data (`data/weapons.ts`)

```ts
export const DAGGER = {
  cooldown: 0.5,      // seconds between fires
  damage: 10,
  projectileSpeed: 800, // px/sec
  projectileLifetime: 1.5, // seconds
  projectileRadius: 6,
  pierce: 1,          // enemies hit before despawn
  count: 1,           // projectiles per fire (level-up territory)
};
```

Everything is data. The Dagger *system* reads these numbers and never hardcodes them.

## Targeting

Use the spatial hash, not a linear scan. To find the nearest enemy:

1. Start at the player's grid cell.
2. Search outward in expanding rings of cells until you find a candidate, then check one more ring (a closer enemy can sit in an adjacent cell).
3. Return the nearest within that bounded search.

This keeps targeting O(local density) instead of O(all enemies). At 2,000 enemies a linear nearest-scan every fire is wasteful; the hash makes it cheap.

## Pooling

```ts
// Acquire on fire
const p = projectilePool.acquire();
p.active = true;
p.pos.x = player.pos.x;
p.pos.y = player.pos.y;
// set velocity toward target...

// Release on hit/expiry
projectilePool.release(p);
p.active = false;
```

Never `new` a projectile in the loop. The pool pre-allocates a cap (e.g. 512) and reuses.

## Collision (handled by `systems/collision.ts`)

Each tick, for each active projectile: query the hash for enemies in its cell + neighbors, test circle-vs-circle against `projectileRadius + enemyRadius`. On hit, decrement `pierce`; when pierce hits 0, release. Apply damage and spawn a damage number on every hit.

## Done when

Dagger auto-targets the nearest threat, projectiles read clearly, damage numbers pop, and the whole thing holds frame budget at 2,000 enemies. That's the green light for the Whip.
