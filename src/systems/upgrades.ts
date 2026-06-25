// Level-up upgrades. Each is a small mutation of the per-run weapon/player stats
// (state.weapons / state.player). Stat upgrades are repeatable, but each weapon
// caps at 4 stat picks; the 5th pick for a weapon is its one-time *evolution*
// (see docs/05-weapon-evolutions.md). The roll picks distinct random options and
// force-includes any eligible evolution; it allocates, but only fires on level-up
// (rare, and the sim is paused), so it's off the hot path.

import type { GameState } from "../state/gameState";
import type { WeaponId } from "../state/weapons";

// Stat picks count toward a weapon's level (cap 4) or, when `weapon` is null, are
// global passives that never gate. Evolutions are the 5th-pick payoff and flip
// the weapon's `evolved` flag.
export type UpgradeKind = "stat" | "evolution";

// A weapon may take this many stat upgrades before its evolution unlocks.
export const WEAPON_STAT_CAP = 4;

const WEAPON_IDS: WeaponId[] = ["dagger", "whip", "garlic", "axe", "laser"];

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  weapon: WeaponId | null; // which weapon's level this counts toward (null = global passive)
  kind: UpgradeKind;
  apply: (state: GameState) => void;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "dagger_count",
    name: "Twin Fang",
    desc: "+1 dagger per throw",
    weapon: "dagger",
    kind: "stat",
    apply: (s) => {
      s.weapons.dagger.count += 1;
    },
  },
  {
    id: "dagger_rate",
    name: "Quick Draw",
    desc: "Daggers fire 18% faster",
    weapon: "dagger",
    kind: "stat",
    apply: (s) => {
      s.weapons.dagger.cooldown *= 0.82;
    },
  },
  {
    id: "dagger_dmg",
    name: "Honed Blades",
    desc: "+6 dagger damage",
    weapon: "dagger",
    kind: "stat",
    apply: (s) => {
      s.weapons.dagger.damage += 6;
    },
  },
  {
    id: "whip_dmg",
    name: "Honed Edge",
    desc: "+8 sword damage",
    weapon: "whip",
    kind: "stat",
    apply: (s) => {
      s.weapons.whip.damage += 8;
    },
  },
  {
    id: "whip_rate",
    name: "Swift Strikes",
    desc: "Sword swings 18% faster",
    weapon: "whip",
    kind: "stat",
    apply: (s) => {
      s.weapons.whip.cooldown *= 0.82;
    },
  },
  {
    id: "garlic_dmg",
    name: "Searing",
    desc: "+3 light damage",
    weapon: "garlic",
    kind: "stat",
    apply: (s) => {
      s.weapons.garlic.damage += 3;
    },
  },
  {
    id: "garlic_radius",
    name: "Wide Beam",
    desc: "+25% light ray thickness",
    weapon: "garlic",
    kind: "stat",
    apply: (s) => {
      s.weapons.garlic.radius *= 1.25;
    },
  },
  {
    id: "axe_dmg",
    name: "Sharpened Axe",
    desc: "+10 axe damage",
    weapon: "axe",
    kind: "stat",
    apply: (s) => {
      s.weapons.axe.damage += 10;
    },
  },
  {
    id: "axe_rate",
    name: "Berserker",
    desc: "Axe throws 18% faster",
    weapon: "axe",
    kind: "stat",
    apply: (s) => {
      s.weapons.axe.cooldown *= 0.82;
    },
  },
  {
    id: "laser_dmg",
    name: "Optic Blast",
    desc: "+6 laser damage",
    weapon: "laser",
    kind: "stat",
    apply: (s) => {
      s.weapons.laser.damage += 6;
    },
  },
  {
    id: "laser_rate",
    name: "Overcharge",
    desc: "Laser recharges 15% faster",
    weapon: "laser",
    kind: "stat",
    apply: (s) => {
      s.weapons.laser.cooldown *= 0.85;
    },
  },
  {
    id: "move_speed",
    name: "Swift Boots",
    desc: "+12% move speed",
    weapon: null,
    kind: "stat",
    apply: (s) => {
      s.player.speed *= 1.12;
    },
  },
  // (Vitality / +max-HP removed — health is being reworked.)
  {
    id: "magnet",
    name: "Magnetism",
    desc: "+30% gem pickup range",
    weapon: null,
    kind: "stat",
    apply: (s) => {
      s.player.magnetRadius *= 1.3;
    },
  },
  // Global passives — these buff every weapon at once (via state.passives), not a
  // single weapon's stats. Weapons fold the multipliers in at the source.
  {
    id: "passive_dmg",
    name: "Bloodlust",
    desc: "+10% all weapon damage",
    weapon: null,
    kind: "stat",
    apply: (s) => {
      s.passives.damageMult *= 1.1;
    },
  },
  {
    id: "passive_rate",
    name: "Frenzy",
    desc: "+5% all weapon fire rate",
    weapon: null,
    kind: "stat",
    apply: (s) => {
      s.passives.fireRateMult *= 1.05;
    },
  },
  {
    id: "passive_aoe",
    name: "Resonance",
    desc: "+10% area of effect",
    weapon: null,
    kind: "stat",
    apply: (s) => {
      s.passives.aoeMult *= 1.1;
    },
  },

  // Evolutions — the 5th-pick payoff for a maxed weapon. Each only flips the
  // `evolved` flag here; the powered-up firing behavior + tuning lives in the
  // weapon's update*() branch (step 4, docs/05). One per weapon.
  {
    id: "dagger_evo",
    name: "Thousand Fangs",
    desc: "Daggers become a relentless forward stream",
    weapon: "dagger",
    kind: "evolution",
    apply: (s) => {
      s.weapons.dagger.evolved = true;
    },
  },
  {
    id: "whip_evo",
    name: "Flurry",
    desc: "The sword swings twice as fast, with greater reach",
    weapon: "whip",
    kind: "evolution",
    apply: (s) => {
      s.weapons.whip.evolved = true;
    },
  },
  {
    id: "garlic_evo",
    name: "Refraction",
    desc: "Light fires both up and down, with more bounces",
    weapon: "garlic",
    kind: "evolution",
    apply: (s) => {
      // Evolved behavior (dual rays, extra reflections, faster cadence) is read at
      // fire time from `evolved` + GARLIC.evo, like the axe/laser evolutions.
      s.weapons.garlic.evolved = true;
    },
  },
  {
    id: "axe_evo",
    name: "Cyclone",
    desc: "Axes spiral outward instead of falling",
    weapon: "axe",
    kind: "evolution",
    apply: (s) => {
      s.weapons.axe.evolved = true;
    },
  },
  {
    id: "laser_evo",
    name: "Prism",
    desc: "The beam splits into a continuous fan",
    weapon: "laser",
    kind: "evolution",
    apply: (s) => {
      s.weapons.laser.evolved = true;
    },
  },
];

/** True once `weapon` has taken its stat cap and may now evolve (but hasn't). */
function evolutionReady(state: GameState, weapon: WeaponId): boolean {
  const w = state.weapons[weapon];
  return w.level >= WEAPON_STAT_CAP && !w.evolved;
}

/** Whether a stat upgrade is still offerable: globals always, weapons until capped. */
function statEligible(state: GameState, u: Upgrade): boolean {
  if (u.kind !== "stat") return false;
  if (u.weapon === null) return true; // global passives never gate
  const w = state.weapons[u.weapon];
  return w.level < WEAPON_STAT_CAP && !w.evolved;
}

/**
 * Pick `n` distinct upgrade choices for a level-up. Any weapon that has hit its
 * stat cap gets its evolution card *guaranteed* a slot (gold-styled in the menu);
 * the rest of the slots fill with distinct random eligible stat upgrades. If more
 * than `n` weapons are evolution-ready at once, the surplus simply wait for the
 * next level-up — they stay ready until taken.
 */
export function rollUpgrades(state: GameState, n: number): Upgrade[] {
  const out: Upgrade[] = [];

  // Guaranteed: every ready evolution, capped at n slots (surplus defers).
  for (const u of UPGRADES) {
    if (out.length >= n) break;
    if (u.kind === "evolution" && evolutionReady(state, u.weapon!)) {
      out.push(u);
    }
  }

  // Bootstrap: weapons start at level 0 (not firing). Until at least one is active,
  // EVERY choice is a weapon (no passives) so the player must turn a weapon on and
  // the kill→gem→upgrade loop can actually start.
  const anyActive = WEAPON_IDS.some((w) => state.weapons[w].level >= 1);

  // Fill remaining slots from distinct random stat upgrades.
  let pool = UPGRADES.filter((u) => statEligible(state, u));
  if (!anyActive) pool = pool.filter((u) => u.weapon !== null);
  while (out.length < n && pool.length > 0) {
    const idx = state.rng.int(0, pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }

  return out;
}
