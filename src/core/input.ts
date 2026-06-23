// Keyboard input state. Tracks which keys are down; gameplay reads axes from it.
// Stays out of GameState — input is an edge-of-system concern, not world data.

export class Input {
  private down = new Set<string>();

  attach(): void {
    window.addEventListener("keydown", (e) => {
      // Don't swallow devtools / refresh shortcuts.
      if (e.metaKey || e.ctrlKey) return;
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    // Dropping focus must release everything, or keys "stick" held.
    window.addEventListener("blur", () => this.down.clear());
  }

  /** -1 left, +1 right, 0 none. */
  axisX(): number {
    let x = 0;
    if (this.down.has("KeyA") || this.down.has("ArrowLeft")) x -= 1;
    if (this.down.has("KeyD") || this.down.has("ArrowRight")) x += 1;
    return x;
  }

  /** -1 up, +1 down, 0 none. */
  axisY(): number {
    let y = 0;
    if (this.down.has("KeyW") || this.down.has("ArrowUp")) y -= 1;
    if (this.down.has("KeyS") || this.down.has("ArrowDown")) y += 1;
    return y;
  }
}
