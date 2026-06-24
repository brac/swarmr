// Level-up upgrades. Each is a small mutation of the per-run weapon/player stats
// (state.weapons / state.player). Stat upgrades are repeatable, but each weapon
// caps at 4 stat picks; the 5th pick for a weapon is its one-time *evolution*
// (see docs/05-weapon-evolutions.md). The roll picks distinct random options and
// force-includes any eligible evolution; it allocates, but only fires on level-up
// (rare, and the sim is paused), so it's off the hot path.

import type { GameState } from "../state/gameState";
import type { WeaponId } from "../state/weapons";
import { GARLIC } from "../data/weapons";

// Stat picks count toward a weapon's level (cap 4) or, when `weapon` is null, are
// global passives that never gate. Evolutions are the 5th-pick payoff and flip
// the weapon's `evolved` flag.
export type UpgradeKind = "stat" | "evolution";

// A weapon may take this many stat upgrades before its evolution unlocks.
export const WEAPON_STAT_CAP = 4;

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
    name: "Heavy Whip",
    desc: "+8 whip damage",
    weapon: "whip",
    kind: "stat",
    apply: (s) => {
      s.weapons.whip.damage += 8;
    },
  },
  {
    id: "whip_rate",
    name: "Crackdown",
    desc: "Whip swings 18% faster",
    weapon: "whip",
    kind: "stat",
    apply: (s) => {
      s.weapons.whip.cooldown *= 0.82;
    },
  },
  {
    id: "garlic_dmg",
    name: "Pungent",
    desc: "+3 garlic damage",
    weapon: "garlic",
    kind: "stat",
    apply: (s) => {
      s.weapons.garlic.damage += 3;
    },
  },
  {
    id: "garlic_radius",
    name: "Reek",
    desc: "+25% garlic radius",
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
  {
    id: "max_hp",
    name: "Vitality",
    desc: "+25 max HP, heal 25",
    weapon: null,
    kind: "stat",
    apply: (s) => {
      s.player.maxHp += 25;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25);
    },
  },
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
    name: "Reaper",
    desc: "The whip sweeps a full circle each swing",
    weapon: "whip",
    kind: "evolution",
    apply: (s) => {
      s.weapons.whip.evolved = true;
    },
  },
  {
    id: "garlic_evo",
    name: "Black Aura",
    desc: "Garlic darkens into a searing, far-reaching aura",
    weapon: "garlic",
    kind: "evolution",
    apply: (s) => {
      s.weapons.garlic.evolved = true;
      // Fold the bigger/harder aura into the live stats so the existing aura
      // scaling (gameplay + renderer) tracks it; the faster re-tick is read in
      // garlic.ts. The recolor is the renderer's job.
      s.weapons.garlic.radius *= GARLIC.evo.radiusMult;
      s.weapons.garlic.damage *= GARLIC.evo.damageMult;
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

  // Fill remaining slots from distinct random stat upgrades.
  const pool = UPGRADES.filter((u) => statEligible(state, u));
  while (out.length < n && pool.length > 0) {
    const idx = state.rng.int(0, pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }

  return out;
}
