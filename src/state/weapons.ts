// Per-run, MUTABLE weapon stats. The data/ weapon consts are the *defaults*;
// this holds the live values that level-up upgrades modify and that restart
// resets (by building a fresh copy). Weapons read upgradeable fields from here;
// static fields (projectile speed, arc shape, gravity, …) stay on the consts.

import { DAGGER, WHIP, GARLIC, AXE, LASER } from "../data/weapons";

// The five upgradeable weapons. `null` elsewhere means a global passive that
// belongs to no single weapon.
export type WeaponId = "dagger" | "whip" | "garlic" | "axe" | "laser";

// Per-weapon evolution bookkeeping shared by every slot (see docs/05). `level`
// counts upgrade picks taken for this weapon (4 stat picks → the 5th pick is the
// evolution); `evolved` flips true once that evolution is taken, which both
// switches the weapon's firing branch and retires it from the upgrade pool.
interface WeaponProgress {
  level: number;
  evolved: boolean;
}

export interface WeaponState {
  dagger: WeaponProgress & { cooldown: number; damage: number; count: number };
  whip: WeaponProgress & { cooldown: number; damage: number };
  garlic: WeaponProgress & { cooldown: number; radius: number; damage: number };
  axe: WeaponProgress & { cooldown: number; damage: number };
  laser: WeaponProgress & { cooldown: number; damage: number };
}

export function createWeaponState(): WeaponState {
  return {
    dagger: {
      level: 0,
      evolved: false,
      cooldown: DAGGER.cooldown,
      damage: DAGGER.damage,
      count: DAGGER.count,
    },
    whip: { level: 0, evolved: false, cooldown: WHIP.cooldown, damage: WHIP.damage },
    garlic: {
      level: 0,
      evolved: false,
      cooldown: GARLIC.cooldown,
      radius: GARLIC.radius,
      damage: GARLIC.damage,
    },
    axe: { level: 0, evolved: false, cooldown: AXE.cooldown, damage: AXE.damage },
    laser: { level: 0, evolved: false, cooldown: LASER.cooldown, damage: LASER.damage },
  };
}
