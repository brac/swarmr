// Per-run, MUTABLE weapon stats. The data/ weapon consts are the *defaults*;
// this holds the live values that level-up upgrades modify and that restart
// resets (by building a fresh copy). Weapons read upgradeable fields from here;
// static fields (projectile speed, arc shape, gravity, …) stay on the consts.

import { DAGGER, WHIP, GARLIC, AXE, LASER } from "../data/weapons";

export interface WeaponState {
  dagger: { cooldown: number; damage: number; count: number };
  whip: { cooldown: number; damage: number };
  garlic: { radius: number; damage: number };
  axe: { cooldown: number; damage: number };
  laser: { cooldown: number; damage: number };
}

export function createWeaponState(): WeaponState {
  return {
    dagger: {
      cooldown: DAGGER.cooldown,
      damage: DAGGER.damage,
      count: DAGGER.count,
    },
    whip: { cooldown: WHIP.cooldown, damage: WHIP.damage },
    garlic: { radius: GARLIC.radius, damage: GARLIC.damage },
    axe: { cooldown: AXE.cooldown, damage: AXE.damage },
    laser: { cooldown: LASER.cooldown, damage: LASER.damage },
  };
}
