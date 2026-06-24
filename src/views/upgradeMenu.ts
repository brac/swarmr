// Level-up upgrade menu — a DOM overlay (like the other HUD chrome). When shown
// it presents the rolled choices as cards; picking one (click or number key)
// fires onPick. The sim is paused by the caller while this is open.

import type { Upgrade } from "../systems/upgrades";

export class UpgradeMenu {
  private root: HTMLElement;
  private onPick: (u: Upgrade) => void;
  private choices: Upgrade[] = [];
  private open = false;

  constructor(root: HTMLElement, onPick: (u: Upgrade) => void) {
    this.root = root;
    this.onPick = onPick;
    // Number keys 1..N select while open.
    window.addEventListener("keydown", (e) => {
      if (!this.open) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= this.choices.length) {
        this.pick(n - 1);
      }
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(choices: Upgrade[]): void {
    this.choices = choices;
    this.root.replaceChildren();

    const title = document.createElement("div");
    title.className = "up-title";
    title.textContent = "LEVEL UP — choose an upgrade";
    this.root.appendChild(title);

    const row = document.createElement("div");
    row.className = "up-row";
    choices.forEach((u, i) => {
      const card = document.createElement("button");
      const isEvo = u.kind === "evolution";
      card.className = isEvo ? "up-card up-card--evo" : "up-card";

      // Evolution cards wear a corner ribbon so the payoff is unmistakable.
      if (isEvo) {
        const ribbon = document.createElement("div");
        ribbon.className = "up-ribbon";
        ribbon.textContent = "EVOLUTION";
        card.appendChild(ribbon);
      }

      const num = document.createElement("div");
      num.className = "up-num";
      num.textContent = "" + (i + 1);

      const name = document.createElement("div");
      name.className = "up-name";
      name.textContent = u.name;

      const desc = document.createElement("div");
      desc.className = "up-desc";
      desc.textContent = u.desc;

      card.append(num, name, desc);
      card.addEventListener("click", () => this.pick(i));
      row.appendChild(card);
    });
    this.root.appendChild(row);

    this.root.style.display = "flex";
    this.open = true;
  }

  private pick(i: number): void {
    if (!this.open) return;
    const u = this.choices[i];
    if (!u) return;
    // Close before the callback: it decrements the pending count, and if more
    // level-ups are queued the caller will re-show next frame.
    this.open = false;
    this.root.style.display = "none";
    this.onPick(u);
  }
}
