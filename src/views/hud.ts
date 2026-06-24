// HUD: XP bar + level, HP bar, timer/kills, boss bar, and end overlays. DOM, like
// the perf overlay — costs the Pixi pipeline nothing. Dumb view: reads GameState,
// writes the DOM. Throttled to ~15Hz and change-gated per field so DOM writes/
// reflows stay rare (XP/boss-HP change constantly) — keeps the per-frame path cheap.

import type { GameState } from "../state/gameState";
import { XP } from "../data/xp";

const UPDATE_INTERVAL = 0.066; // ~15Hz

function mmss(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return mm + ":" + (ss < 10 ? "0" : "") + ss;
}

export class Hud {
  private hpText: HTMLElement; // now holds the heart row (♥/♡)
  private xpFill: HTMLElement;
  private levelText: HTMLElement;
  private timerText: HTMLElement;
  private killsText: HTMLElement;
  private bossWrap: HTMLElement;
  private bossFill: HTMLElement;
  private win: HTMLElement;
  private winStats: HTMLElement;
  private death: HTMLElement;

  private accum = UPDATE_INTERVAL; // draw on the first frame
  private lastHp = NaN;
  private lastXpPct = NaN;
  private lastLevel = -1;
  private lastLeveling = true;
  private lastSeconds = -1;
  private lastKills = -1;
  private lastBossActive = false;
  private lastBossPct = NaN;
  private lastWon = false;
  private lastGameOver = false;

  constructor(
    hp: { fill: HTMLElement; text: HTMLElement },
    xp: { fill: HTMLElement; level: HTMLElement },
    stats: { timer: HTMLElement; kills: HTMLElement },
    boss: { wrap: HTMLElement; fill: HTMLElement },
    end: { win: HTMLElement; winStats: HTMLElement; death: HTMLElement },
  ) {
    this.hpText = hp.text;
    this.xpFill = xp.fill;
    this.levelText = xp.level;
    this.timerText = stats.timer;
    this.killsText = stats.kills;
    this.bossWrap = boss.wrap;
    this.bossFill = boss.fill;
    this.win = end.win;
    this.winStats = end.winStats;
    this.death = end.death;
  }

  update(state: GameState, dt: number): void {
    this.accum += dt;
    if (this.accum < UPDATE_INTERVAL) return;
    this.accum = 0;

    const p = state.player;

    if (p.hp !== this.lastHp) {
      // Health is a 5-heart tracker: filled ♥ per remaining heart, ♡ for lost.
      const left = Math.max(0, Math.round(p.hp));
      let hearts = "";
      for (let i = 0; i < p.maxHp; i++) hearts += i < left ? "♥" : "♡";
      this.hpText.textContent = hearts;
      this.lastHp = p.hp;
    }

    // The bar now tracks gems banked toward the run total (p.xp = gems collected).
    const xpPct = Math.min(1, p.xp / XP.runTotal);
    if (xpPct !== this.lastXpPct) {
      this.xpFill.style.width = xpPct * 100 + "%";
      this.lastXpPct = xpPct;
    }

    const seconds = Math.floor(state.time);
    if (seconds !== this.lastSeconds) {
      this.timerText.textContent = mmss(seconds);
      this.lastSeconds = seconds;
    }

    if (state.kills !== this.lastKills) {
      this.killsText.textContent = state.kills + " kills";
      this.lastKills = state.kills;
    }

    if (p.level !== this.lastLevel || state.levelingEnabled !== this.lastLeveling) {
      // " ❄" marks leveling frozen by the debug toggle.
      this.levelText.textContent =
        "LV " + p.level + (state.levelingEnabled ? "" : " ❄");
      this.lastLevel = p.level;
      this.lastLeveling = state.levelingEnabled;
    }

    const boss = state.boss;
    if (boss.active !== this.lastBossActive) {
      this.bossWrap.style.display = boss.active ? "flex" : "none";
      this.lastBossActive = boss.active;
    }
    if (boss.active) {
      const pct = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
      if (pct !== this.lastBossPct) {
        this.bossFill.style.width = pct * 100 + "%";
        this.lastBossPct = pct;
      }
    }

    if (state.won !== this.lastWon) {
      if (state.won) {
        this.winStats.textContent =
          "Survived " + mmss(seconds) + " · " + state.kills + " kills";
      }
      this.win.style.display = state.won ? "flex" : "none";
      this.lastWon = state.won;
    }

    if (state.gameOver !== this.lastGameOver) {
      this.death.style.display = state.gameOver ? "flex" : "none";
      this.lastGameOver = state.gameOver;
    }
  }
}
