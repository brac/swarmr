// Dev menu — a non-modal corner panel for exercising weapons at every stage
// without grinding level-ups. Toggle with the backtick (`) key. It mutates the
// live weapon state directly (the same fields upgrades touch), so the running
// game reflects each change immediately. Debug-only; not part of the game UI.

import type { GameState } from "../state/gameState";
import type { WeaponId } from "../state/weapons";
import { createWeaponState } from "../state/weapons";
import { UPGRADES, WEAPON_STAT_CAP } from "../systems/upgrades";

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

      const label = document.createElement("div");
      const stage = w.evolved ? "EVOLVED" : `Lv ${w.level}/${WEAPON_STAT_CAP}`;
      label.textContent = `${wid.padEnd(7)} ${stage}`;
      label.style.color = w.evolved ? "#ffd86b" : "#aab2c5";
      row.appendChild(label);

      const btns = document.createElement("div");
      Object.assign(btns.style, { display: "flex", gap: "4px" } as CSSStyleDeclaration);
      btns.append(
        this.button("Base", () => this.act(() => this.resetWeapon(s, wid))),
        this.button("+1", () => this.act(() => this.addStat(s, wid))),
        this.button("Max", () => this.act(() => this.maxWeapon(s, wid))),
        this.button("Evolve", () => this.act(() => this.evolveWeapon(s, wid))),
      );
      row.appendChild(btns);
      this.root.appendChild(row);
    }

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
