// HUD: XP bar + level, player HP bar, and death overlay. DOM, like the perf
// overlay — costs the Pixi pipeline nothing. Dumb view: reads GameState, writes
// the DOM. Throttled to ~15Hz and change-gated per field so DOM writes/reflows
// stay rare (XP changes every pickup) — keeps the per-frame path cheap.

import type { GameState } from "../state/gameState";

const UPDATE_INTERVAL = 0.066; // ~15Hz

export class Hud {
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private xpFill: HTMLElement;
  private levelText: HTMLElement;
  private death: HTMLElement;

  private accum = UPDATE_INTERVAL; // draw on the first frame
  private lastHp = NaN;
  private lastXpPct = NaN;
  private lastLevel = -1;
  private lastGameOver = false;

  constructor(
    hp: { fill: HTMLElement; text: HTMLElement },
    xp: { fill: HTMLElement; level: HTMLElement },
    death: HTMLElement,
  ) {
    this.hpFill = hp.fill;
    this.hpText = hp.text;
    this.xpFill = xp.fill;
    this.levelText = xp.level;
    this.death = death;
  }

  update(state: GameState, dt: number): void {
    this.accum += dt;
    if (this.accum < UPDATE_INTERVAL) return;
    this.accum = 0;

    const p = state.player;

    if (p.hp !== this.lastHp) {
      const pct = p.hp > 0 ? p.hp / p.maxHp : 0;
      this.hpFill.style.width = pct * 100 + "%";
      // Green when healthy, red when low — instant read of danger.
      this.hpFill.style.background = pct > 0.3 ? "#2fbf5a" : "#d33a3a";
      this.hpText.textContent = Math.ceil(p.hp) + " / " + p.maxHp;
      this.lastHp = p.hp;
    }

    const xpPct = p.xpToNext > 0 ? p.xp / p.xpToNext : 0;
    if (xpPct !== this.lastXpPct) {
      this.xpFill.style.width = xpPct * 100 + "%";
      this.lastXpPct = xpPct;
    }

    if (p.level !== this.lastLevel) {
      this.levelText.textContent = "LV " + p.level;
      this.lastLevel = p.level;
    }

    if (state.gameOver !== this.lastGameOver) {
      this.death.style.display = state.gameOver ? "flex" : "none";
      this.lastGameOver = state.gameOver;
    }
  }
}
