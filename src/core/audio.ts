// Audio — a view-layer observer, like the renderer/HUD. Systems stay pure; this
// reads GameState each frame and plays a sound on the *edges* that matter (took
// damage, leveled, boss arrived, won, died) plus a throttled pickup blip. Most
// gameplay events (hits/deaths) fire hundreds of times a second, so we never
// sound those — only naturally-rare transitions, keeping it musical, not noise.
//
// Howler auto-resumes the audio context on the first user gesture, so no explicit
// unlock is needed (the player clicks/keys to play).

import { Howl, Howler } from "howler";
import type { GameState } from "../state/gameState";

const PICKUP_THROTTLE = 0.08; // min seconds between pickup blips

export class Audio {
  private s: Record<string, Howl>;

  private lastHp = NaN;
  private lastLevel = -1;
  private lastXp = 0;
  private lastBoss = false;
  private lastWon = false;
  private lastGameOver = false;
  private pickupCooldown = 0;
  private muted = false;

  constructor() {
    // BASE_URL respects Vite's base ("/" in dev, "/swarmr/" on GitHub Pages).
    const base = import.meta.env.BASE_URL;
    const mk = (name: string, volume: number) =>
      new Howl({ src: [base + "sounds/" + name + ".wav"], volume });
    this.s = {
      pickup: mk("pickup", 0.25),
      hurt: mk("hurt", 0.5),
      levelup: mk("levelup", 0.5),
      boss: mk("boss", 0.7),
      win: mk("win", 0.6),
      death: mk("death", 0.6),
    };
  }

  /** Observe state and fire sounds on edges. Call once per rendered frame. */
  update(state: GameState, dt: number): void {
    const p = state.player;

    // Pickup: XP went up (a gem was collected). Throttle so a god-mode haul
    // doesn't machine-gun the blip.
    this.pickupCooldown -= dt;
    if (p.xp > this.lastXp && this.pickupCooldown <= 0) {
      this.s.pickup!.play();
      this.pickupCooldown = PICKUP_THROTTLE;
    }
    this.lastXp = p.xp;

    // Hurt: HP dropped (any source). Heals/level-resets only raise it.
    if (p.hp < this.lastHp) this.s.hurt!.play();
    this.lastHp = p.hp;

    // Level up (skip the initial -1 → 1 seed).
    if (p.level > this.lastLevel && this.lastLevel !== -1) this.s.levelup!.play();
    this.lastLevel = p.level;

    if (state.boss.active && !this.lastBoss) this.s.boss!.play();
    this.lastBoss = state.boss.active;

    if (state.won && !this.lastWon) this.s.win!.play();
    this.lastWon = state.won;

    if (state.gameOver && !this.lastGameOver) this.s.death!.play();
    this.lastGameOver = state.gameOver;
  }

  /** Toggle global mute (debug key M). Returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }
}
