// DOM perf overlay. Plain HTML/CSS so it costs the Pixi pipeline nothing and
// needs no bitmap font yet. The instrument we rely on at the 2,000-enemy
// checkpoint: if logic-tick-ms or render-ms blow the budget, we see it here.

import type { Loop } from "../core/loop";

const BUDGET_LOGIC_MS = 4;
const BUDGET_RENDER_MS = 8;

export class PerfOverlay {
  private el: HTMLElement;
  private accum = 0;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  /** Call once per rendered frame; throttles its own DOM writes to ~5Hz. */
  update(loop: Loop, dtSeconds: number, entityCount = 0): void {
    this.accum += dtSeconds;
    if (this.accum < 0.2) return;
    this.accum = 0;

    const logic = loop.updateMs.toFixed(2);
    const render = loop.renderMs.toFixed(2);
    const logicFlag = loop.updateMs > BUDGET_LOGIC_MS ? " !" : "";
    const renderFlag = loop.renderMs > BUDGET_RENDER_MS ? " !" : "";

    this.el.textContent =
      `fps     ${loop.fps.toFixed(0)}\n` +
      `logic   ${logic}ms / ${BUDGET_LOGIC_MS}ms${logicFlag}\n` +
      `render  ${render}ms / ${BUDGET_RENDER_MS}ms${renderFlag}\n` +
      `ticks   ${loop.ticksLastFrame}\n` +
      `enemies ${entityCount}`;
  }
}
