// Dev menu — a non-modal corner panel for exercising weapons at every stage
// without grinding level-ups. Toggle with the backtick (`) key. It mutates the
// live weapon state directly (the same fields upgrades touch), so the running
// game reflects each change immediately. Debug-only; not part of the game UI.

import type { GameState } from "../state/gameState";
import type { WeaponId } from "../state/weapons";
import { createWeaponState } from "../state/weapons";
import { UPGRADES, WEAPON_STAT_CAP } from "../systems/upgrades";
import { RAMP } from "../data/waves";

const WEAPONS: WeaponId[] = ["dagger", "whip", "garlic", "axe", "laser"];

interface DevActions {
  spawnBoss: () => void;
  levelUp: () => void;
}

export class DevMenu {
  private root: HTMLElement;
  private getState: () => GameState;
  private actions: DevActions;
  private open = false;

  constructor(getState: () => GameState, actions: DevActions) {
    this.getState = getState;
    this.actions = actions;

    const root = document.createElement("div");
    Object.assign(root.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      zIndex: "50",
      display: "none",
      flexDirection: "column",
      gap: "8px",
      padding: "12px 14px",
      background: "rgba(12,15,22,0.92)",
      border: "1px solid #2a3142",
      borderRadius: "8px",
      font: "12px/1.3 monospace",
      color: "#e6ebf5",
      width: "260px",
      maxHeight: "92vh",
      overflowY: "auto",
      pointerEvents: "auto",
      userSelect: "none",
    } as CSSStyleDeclaration);
    this.root = root;
    document.body.appendChild(root);
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.open = !this.open;
    this.root.style.display = this.open ? "flex" : "none";
    if (this.open) this.render();
  }

  // --- mutations -----------------------------------------------------------

  /** Stat upgrades for a weapon, in declaration order (cycled when capped). */
  private statsFor(wid: WeaponId) {
    return UPGRADES.filter((u) => u.weapon === wid && u.kind === "stat");
  }

  private resetWeapon(s: GameState, wid: WeaponId): void {
    Object.assign(s.weapons[wid], createWeaponState()[wid]);
  }

  private addStat(s: GameState, wid: WeaponId): void {
    const w = s.weapons[wid];
    if (w.level >= WEAPON_STAT_CAP || w.evolved) return;
    const stats = this.statsFor(wid);
    stats[w.level % stats.length]!.apply(s);
    w.level += 1;
  }

  private maxWeapon(s: GameState, wid: WeaponId): void {
    while (s.weapons[wid].level < WEAPON_STAT_CAP && !s.weapons[wid].evolved) {
      this.addStat(s, wid);
    }
  }

  private evolveWeapon(s: GameState, wid: WeaponId): void {
    if (s.weapons[wid].evolved) return;
    this.maxWeapon(s, wid);
    const evo = UPGRADES.find((u) => u.weapon === wid && u.kind === "evolution");
    evo?.apply(s); // flips `evolved` (and folds in any evolution stat changes)
    s.weapons[wid].level = WEAPON_STAT_CAP;
  }

  private act(fn: () => void): void {
    fn();
    this.render();
    // Drop focus so Space/Enter don't re-trigger the last button while playing.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  // --- rendering -----------------------------------------------------------

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = label;
    b.tabIndex = -1;
    Object.assign(b.style, {
      flex: "1",
      padding: "3px 0",
      background: "#1d2433",
      border: "1px solid #2a3142",
      borderRadius: "5px",
      color: "#cdd7ea",
      font: "11px monospace",
      cursor: "pointer",
    } as CSSStyleDeclaration);
    b.addEventListener("click", onClick);
    return b;
  }

  // A "label [number input]" row. Typing a value sets it live (on change, not
  // per-keystroke) without re-rendering, so the field keeps focus while tuning.
  private numberField(
    label: string,
    value: number,
    step: number,
    onSet: (v: number) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    } as CSSStyleDeclaration);
    const lbl = document.createElement("div");
    lbl.textContent = label;
    lbl.style.color = "#aab2c5";
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = String(Math.round(value * 1000) / 1000);
    input.tabIndex = -1;
    Object.assign(input.style, {
      width: "82px",
      background: "#1d2433",
      border: "1px solid #2a3142",
      borderRadius: "5px",
      color: "#cdd7ea",
      font: "11px monospace",
      padding: "2px 4px",
    } as CSSStyleDeclaration);
    input.addEventListener("change", () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) onSet(v);
    });
    row.append(lbl, input);
    return row;
  }

  private render(): void {
    if (!this.open) return;
    const s = this.getState();
    this.root.replaceChildren();

    const title = document.createElement("div");
    title.textContent = "DEV — weapon stages  (` to close)";
    Object.assign(title.style, {
      fontWeight: "bold",
      color: "#ffd86b",
      marginBottom: "2px",
    } as CSSStyleDeclaration);
    this.root.appendChild(title);

    for (const wid of WEAPONS) {
      const w = s.weapons[wid];
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", flexDirection: "column", gap: "3px" } as CSSStyleDeclaration);

      const firing = w.level >= 1;
      const label = document.createElement("div");
      const stage = !firing
        ? "OFF"
        : w.evolved
          ? "EVOLVED"
          : `Lv ${w.level}/${WEAPON_STAT_CAP}`;
      label.textContent = `${wid.padEnd(7)} ${stage}`;
      label.style.color = !firing ? "#6c7689" : w.evolved ? "#ffd86b" : "#9fe0a0";
      row.appendChild(label);

      const btns = document.createElement("div");
      Object.assign(btns.style, { display: "flex", gap: "4px" } as CSSStyleDeclaration);
      btns.append(
        // Toggle firing: OFF resets the weapon to level 0; ON brings it to level 1.
        this.button(firing ? "Off" : "On", () =>
          this.act(() => {
            if (s.weapons[wid].level >= 1) this.resetWeapon(s, wid);
            else s.weapons[wid].level = 1;
          }),
        ),
        this.button("+1", () => this.act(() => this.addStat(s, wid))),
        this.button("Max", () => this.act(() => this.maxWeapon(s, wid))),
        this.button("Evolve", () => this.act(() => this.evolveWeapon(s, wid))),
      );
      row.appendChild(btns);
      this.root.appendChild(row);
    }

    // Spawn-cap slider: pin the live swarm size (overrides the ramp), or Auto.
    const spawn = document.createElement("div");
    Object.assign(spawn.style, { display: "flex", flexDirection: "column", gap: "3px", marginTop: "4px" } as CSSStyleDeclaration);
    const spawnLabel = document.createElement("div");
    const over = s.spawnTargetOverride;
    spawnLabel.textContent =
      over >= 0 ? `spawn cap: ${over} (live: ${s.enemies.count})` : `spawn cap: auto (live: ${s.enemies.count})`;
    spawnLabel.style.color = "#aab2c5";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = String(RAMP.rampToCount);
    slider.step = "50";
    slider.value = String(over >= 0 ? over : s.enemies.count);
    slider.tabIndex = -1;
    slider.style.width = "100%";
    slider.addEventListener("input", () => {
      const v = Number(slider.value);
      this.getState().spawnTargetOverride = v; // live state, survives restart
      spawnLabel.textContent = `spawn cap: ${v} (live: ${this.getState().enemies.count})`;
    });
    spawn.append(spawnLabel, slider);
    this.root.appendChild(spawn);

    // Uncapped passives / player stats — type a value to set it live (these
    // upgrades never max, so tune their effective values directly here).
    const psep = document.createElement("div");
    psep.style.borderTop = "1px solid #2a3142";
    psep.style.margin = "4px 0 2px";
    this.root.appendChild(psep);
    const ptitle = document.createElement("div");
    ptitle.textContent = "passives / stats";
    ptitle.style.color = "#8fa0bd";
    this.root.appendChild(ptitle);

    const fields = document.createElement("div");
    Object.assign(fields.style, { display: "flex", flexDirection: "column", gap: "3px" } as CSSStyleDeclaration);
    fields.append(
      this.numberField("Damage ×", s.passives.damageMult, 0.1, (v) => {
        this.getState().passives.damageMult = v;
      }),
      this.numberField("Fire rate ×", s.passives.fireRateMult, 0.05, (v) => {
        this.getState().passives.fireRateMult = v;
      }),
      this.numberField("AoE ×", s.passives.aoeMult, 0.1, (v) => {
        this.getState().passives.aoeMult = v;
      }),
      this.numberField("Move speed", s.player.speed, 10, (v) => {
        this.getState().player.speed = v;
      }),
      this.numberField("Magnet radius", s.player.magnetRadius, 10, (v) => {
        this.getState().player.magnetRadius = v;
      }),
      this.numberField("Pickup radius", s.player.pickupRadius, 5, (v) => {
        this.getState().player.pickupRadius = v;
      }),
    );
    this.root.appendChild(fields);

    // Global helpers.
    const sep = document.createElement("div");
    sep.style.borderTop = "1px solid #2a3142";
    sep.style.margin = "4px 0 2px";
    this.root.appendChild(sep);

    const global = document.createElement("div");
    Object.assign(global.style, { display: "flex", gap: "4px", flexWrap: "wrap" } as CSSStyleDeclaration);
    global.append(
      this.button("Evolve all", () =>
        this.act(() => {
          for (const wid of WEAPONS) this.evolveWeapon(s, wid);
        }),
      ),
      this.button("Reset all", () =>
        this.act(() => {
          for (const wid of WEAPONS) this.resetWeapon(s, wid);
        }),
      ),
      this.button("God", () => this.act(() => { s.godMode = !s.godMode; })),
      this.button("Auto spawn", () => this.act(() => { s.spawnTargetOverride = -1; })),
      this.button("+Level", () => this.act(() => this.actions.levelUp())),
      this.button("Spawn boss", () => this.act(() => this.actions.spawnBoss())),
    );
    this.root.appendChild(global);

    const god = document.createElement("div");
    god.textContent = `god mode: ${s.godMode ? "ON" : "off"}`;
    god.style.color = s.godMode ? "#7fd97f" : "#6c7689";
    this.root.appendChild(god);
  }
}
