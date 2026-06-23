// Damage-number lifecycle: drift upward, age out, release. Pure state update;
// the renderer reads age for the fade.

import type { GameState } from "../state/gameState";
import { DN_TTL, DN_RISE } from "../state/damageNumbers";

export function updateDamageNumbers(state: GameState, dt: number): void {
  const dn = state.damageNumbers;
  // Downward so swap-remove doesn't skip the swapped-in element.
  for (let i = dn.count - 1; i >= 0; i--) {
    dn.age[i]! += dt;
    dn.posY[i]! -= DN_RISE * dt;
    if (dn.age[i]! >= DN_TTL) dn.kill(i);
  }
}
