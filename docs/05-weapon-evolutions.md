# 05 — Weapon Evolutions

Backlog item: *"Each weapon can only be upgraded 5 times. At the 5th upgrade it
becomes something much more powerful."*

The genre's signature progression hook. We already have the level-up menu, a
flat upgrade pool, and one `update*()` system per weapon — evolutions add a
per-weapon **level cap** and a powered-up firing branch. No new engine
subsystems: every evolution reuses an existing hitbox shape (projectile pool,
whip wedge, garlic disc, laser line-segment).

## Locked decisions

- **Trigger: the 5th pick *is* the evolution.** A weapon takes 4 stat upgrades
  (level 1→4), then its evolution becomes available as the 5th and final pick.
  No paired-passive prerequisite (that's the Vampire-Survivors model; we chose
  the simpler backlog-literal reading).
- **Offer: guaranteed special card.** Once a weapon is evolution-eligible
  (level 4, not yet evolved), its evolution card is **always present** in the
  3 choices, gold-styled. The player still chooses it (agency + the "moment"),
  but RNG can never lock them out.
- **Cap:** after evolving, the weapon is maxed and leaves the upgrade pool
  entirely (no more cards for it).

## New primitive: per-weapon level

`WeaponState` gains a `level` and an `evolved` flag per weapon. Today the pool
has multiple stat upgrades per weapon (dagger: count/rate/dmg). Each stat pick
increments that weapon's `level`. The evolution pick sets `evolved = true`.

```ts
// state/weapons.ts
interface WeaponSlot { level: number; evolved: boolean; /* + existing stats */ }
```

Level counts *picks for that weapon*, not which stat — taking count+rate+dmg+dmg
is level 4 and unlocks the evolution. (Simplest; matches "upgraded 5 times".)

## Roll gating (`systems/upgrades.ts`)

`rollUpgrades` becomes level-aware. Signature changes from `(rng, n)` to
`(state, n)` (it already needs `state.rng`; now it also reads weapon levels).

Per weapon:
- **level < 4:** its stat upgrades are eligible pool entries.
- **level === 4, not evolved:** its stat upgrades drop out; its **evolution
  card is force-included** in the returned choices (one guaranteed slot per
  eligible weapon; remaining slots fill from the random pool).
- **evolved:** the weapon contributes nothing.

Each upgrade entry needs a `weapon` tag (`"dagger" | … | null` for global
passives) and a `kind` (`"stat" | "evolution"`) so the roller can group them.
Evolution entries set `evolved = true` and apply the powered-up stats.

Edge case: if multiple weapons are simultaneously eligible, guaranteed
evolution cards take priority for the 3 slots (cap at 3; if >3 eligible, the
extras wait for the next level-up — `log`/comment this, don't silently drop).

## Per-weapon evolutions

Each is a branch inside the existing `update*()` system, keyed on
`state.weapons.<w>.evolved`. Static evolution tunables live in `data/weapons.ts`
(e.g. `DAGGER.evo = { … }`), live values stay on `WeaponState`.

| Weapon | Evolution name | Behavior | Reuses |
|---|---|---|---|
| Dagger | Thousand Fangs | Three parallel daggers forming a fast, fat row along facing; constant fire, no pierce | projectile pool |
| Axe    | Cyclone        | 8 axes flung outward on a rotating ring (spiral), gravity off, each 100% bigger | projectile pool + spiral angle on state; axe pool gains vertex scaling |
| Garlic | Black Aura     | Larger radius, ~3× damage, faster re-tick; dark tint; flicks a tendril to each struck enemy per hit | garlic disc + `Tendrils` visual pool |
| Whip   | Reaper         | Keeps the wedge but alternates the swing front → back → front on a faster cadence at extended reach | whip wedge (scaled up) |
| Laser  | Prism          | Same cadence as the base beam (on 1000ms, softer per tick). Unlike the base beam it does NOT run off screen: each beam stops at what it reflects off of, splits into two outer beams, and shrinks (shorter + thinner) each reflection — gone after 5 (a tree of segments in `state.laserSegments`) | laser line-segment, pooled beam Graphics scaled per segment |

Names/numbers are placeholders — balance pass after the mechanic works.

## UI (`views/upgradeMenu.ts`)

Evolution cards get an `up-card--evo` class (gold border + an "EVOLUTION"
ribbon). The `Upgrade` interface gains an optional `evolution?: boolean` so the
menu can style without string-matching.

## Build order

1. `state/weapons.ts` — add `level` + `evolved` per weapon; init in
   `createWeaponState` (restart resets via the fresh copy, like passives).
2. `systems/upgrades.ts` — tag entries with `weapon`/`kind`; add evolution
   entries; rewrite `rollUpgrades` to be level-aware + force-include eligible
   evolutions. Update the call site in `main.ts` (`rollUpgrades(state, 3)`).
3. `views/upgradeMenu.ts` + CSS — gold evolution card styling.
4. Weapon systems — add the `evolved` branch to each `update*()`, one at a
   time (dagger first; it's the simplest and the template for the rest).
5. Balance pass once all five fire correctly.

## Testing

`views/devMenu.ts` (toggle with the backtick `` ` `` key) sets any weapon to
base / +1 / max / evolved on the fly, so each stage and evolution can be checked
without grinding level-ups. Debug-only.

## Out of scope (this item)

- Paired-passive unlock conditions (VS-style) — deliberately skipped.
- New weapons (Holy Water / Bible / Fireball) — backlog item #6, separate.
- Re-rolling / banishing upgrade choices.
