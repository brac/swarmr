// Level-up upgrades. Each is a small mutation of the per-run weapon/player stats
// (state.weapons / state.player). They're repeatable and uncapped for now. The
// roll picks distinct random options; it allocates, but only fires on level-up
// (rare, and the sim is paused), so it's off the hot path.

import type { GameState } from "../state/gameState";
import type { Rng } from "../core/rng";

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  apply: (state: GameState) => void;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "dagger_count",
    name: "Twin Fang",
    desc: "+1 dagger per throw",
    apply: (s) => {
      s.weapons.dagger.count += 1;
    },
  },
  {
    id: "dagger_rate",
    name: "Quick Draw",
    desc: "Daggers fire 18% faster",
    apply: (s) => {
      s.weapons.dagger.cooldown *= 0.82;
    },
  },
  {
    id: "dagger_dmg",
    name: "Honed Blades",
    desc: "+6 dagger damage",
    apply: (s) => {
      s.weapons.dagger.damage += 6;
    },
  },
  {
    id: "whip_dmg",
    name: "Heavy Whip",
    desc: "+8 whip damage",
    apply: (s) => {
      s.weapons.whip.damage += 8;
    },
  },
  {
    id: "whip_rate",
    name: "Crackdown",
    desc: "Whip swings 18% faster",
    apply: (s) => {
      s.weapons.whip.cooldown *= 0.82;
    },
  },
  {
    id: "garlic_dmg",
    name: "Pungent",
    desc: "+3 garlic damage",
    apply: (s) => {
      s.weapons.garlic.damage += 3;
    },
  },
  {
    id: "garlic_radius",
    name: "Reek",
    desc: "+25% garlic radius",
    apply: (s) => {
      s.weapons.garlic.radius *= 1.25;
    },
  },
  {
    id: "axe_dmg",
    name: "Sharpened Axe",
    desc: "+10 axe damage",
    apply: (s) => {
      s.weapons.axe.damage += 10;
    },
  },
  {
    id: "axe_rate",
    name: "Berserker",
    desc: "Axe throws 18% faster",
    apply: (s) => {
      s.weapons.axe.cooldown *= 0.82;
    },
  },
  {
    id: "move_speed",
    name: "Swift Boots",
    desc: "+12% move speed",
    apply: (s) => {
      s.player.speed *= 1.12;
    },
  },
  {
    id: "max_hp",
    name: "Vitality",
    desc: "+25 max HP, heal 25",
    apply: (s) => {
      s.player.maxHp += 25;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25);
    },
  },
  {
    id: "magnet",
    name: "Magnetism",
    desc: "+30% gem pickup range",
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
    apply: (s) => {
      s.passives.damageMult *= 1.1;
    },
  },
  {
    id: "passive_rate",
    name: "Frenzy",
    desc: "+5% all weapon fire rate",
    apply: (s) => {
      s.passives.fireRateMult *= 1.05;
    },
  },
  {
    id: "passive_aoe",
    name: "Resonance",
    desc: "+10% area of effect",
    apply: (s) => {
      s.passives.aoeMult *= 1.1;
    },
  },
];

/** Pick `n` distinct random upgrades. */
export function rollUpgrades(rng: Rng, n: number): Upgrade[] {
  const pool = UPGRADES.slice();
  const out: Upgrade[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}
