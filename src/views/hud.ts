// HUD: player HP bar + death overlay. DOM, like the perf overlay — costs the
// Pixi pipeline nothing and needs no bitmap font. Dumb view: reads GameState,
// writes the DOM. Change-gated so it touches the DOM (and allocates the strings
// that implies) only when HP or game-over actually changes — keeps the per-frame
// hot path allocation-free, which is the whole architecture bet.

import type { GameState } from "../state/gameState";

export class Hud {
  private fill: HTMLElement;
  private text: HTMLElement;
  private death: HTMLElement;

  private lastHp = NaN; // force a draw on the first frame
  private lastGameOver = false;

  constructor(
    bar: { fill: HTMLElement; text: HTMLElement },
    death: HTMLElement,
  ) {
    this.fill = bar.fill;
    this.text = bar.text;
    this.death = death;
  }

  update(state: GameState): void {
    const p = state.player;

    if (p.hp !== this.lastHp) {
      const pct = p.hp > 0 ? p.hp / p.maxHp : 0;
      this.fill.style.width = pct * 100 + "%";
      // Green when healthy, red when low — instant read of danger.
      this.fill.style.background = pct > 0.3 ? "#2fbf5a" : "#d33a3a";
      this.text.textContent = Math.ceil(p.hp) + " / " + p.maxHp;
      this.lastHp = p.hp;
    }

    if (state.gameOver !== this.lastGameOver) {
      this.death.style.display = state.gameOver ? "flex" : "none";
      this.lastGameOver = state.gameOver;
    }
  }
}
