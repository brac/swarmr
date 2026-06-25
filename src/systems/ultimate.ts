// Ultimate — a charged annihilation beam. Hold Space for `chargeTime` seconds, then a
// huge wide beam fires forward (+x, facing is locked right) and DESTROYS every mob it
// touches (sets hp=0; collision's end-of-tick compaction sweeps them, counts the kills,
// and drops gems on the usual quota — so a mass kill won't flood the economy). The boss
// is outside the hash and never touched here, so it survives by construction.
//
// Charge rules: releasing Space resets the charge; taking contact/boss damage (HP drops)
// also resets it; after a fire you must release Space before charging again. Ungated for
// now — the passive/weapon combo unlock ("Ultimate trigger") is a later backlog item.
//
// Runs after contact/boss damage (so the hit-cancel sees this tick's damage) and before
// collision (so the instakilled mobs are swept this tick).

import type { GameState } from "../state/gameState";
import type { Input } from "../core/input";
import { ULTIMATE } from "../data/ultimate";

export function updateUltimate(state: GameState, input: Input, dt: number): void {
  const held =
    input.isHeld("Space") &&
    !state.gameOver &&
    !state.won &&
    state.levelUpsPending === 0;

  // Hit-cancel: HP dropped since last tick → a contact/boss hit landed → reset charge.
  if (state.player.hp < state.ultPrevHp) state.ultCharge = 0;
  state.ultPrevHp = state.player.hp;

  // Active beam: tick it down and annihilate everything on the line each tick (so mobs
  // that stream into the band mid-blast also die).
  if (state.ultActive > 0) {
    state.ultActive -= dt;
    applyUltBeam(state);
  }

  if (!held) {
    state.ultCharge = 0; // release resets...
    state.ultLocked = false; // ...and re-arms for the next deliberate charge
  } else if (!state.ultLocked && state.ultActive <= 0) {
    state.ultCharge += dt;
    if (state.ultCharge >= ULTIMATE.chargeTime) {
      state.ultActive = ULTIMATE.duration; // FIRE
      state.ultCharge = 0;
      state.ultLocked = true; // must release Space before charging again
    }
  }
}

// Instakill every enemy on the forward beam line (origin = player, heading +x). Mirrors
// the laser's axis/perp test, but sets hp=0 instead of rolling damage and never touches
// the boss. No damage numbers — a mass instakill would spam them.
function applyUltBeam(state: GameState): void {
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const range = ULTIMATE.range;
  const halfW = ULTIMATE.width * 0.5;

  const e = state.enemies;
  const n = e.count;
  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const radius = e.radius;

  for (let i = 0; i < n; i++) {
    if (hp[i]! <= 0) continue; // already dead this tick
    const er = radius[i]!;
    const rx = posX[i]! - px; // distance along +x
    if (rx < -er || rx > range + er) continue; // behind the player or past the reach
    const dy = posY[i]! - py; // perpendicular distance to the beam line
    const lim = halfW + er;
    if (dy > lim || dy < -lim) continue;
    hp[i] = 0; // destroyed — collision compaction handles death/kills/gems
  }
}
