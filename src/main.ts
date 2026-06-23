// Bootstrap: build the world state, the renderer, and the fixed-timestep loop,
// then wire them together. Phase 0 has no systems yet — update() only advances
// the sim clock. Phase 1 adds input, spawning, movement, weapons here.

import { Loop } from "./core/loop";
import { createGameState } from "./state/gameState";
import { Renderer } from "./views/renderer";
import { PerfOverlay } from "./views/perfOverlay";

const SEED = 0x5eed; // fixed seed → reproducible runs (debugging)

async function main(): Promise<void> {
  const appEl = document.getElementById("app");
  const perfEl = document.getElementById("perf");
  if (!appEl || !perfEl) throw new Error("missing #app or #perf element");

  const state = createGameState(SEED);

  const renderer = new Renderer();
  await renderer.init(appEl);

  const overlay = new PerfOverlay(perfEl);

  const loop = new Loop({
    update: (dt) => {
      // No gameplay systems yet. Just advance the clock so the architecture
      // proves out: fixed dt, deterministic tick count.
      state.time += dt;
      state.tick++;
    },
    render: (alpha) => {
      renderer.render(state, alpha);
      overlay.update(loop, 1 / 60, 0);
    },
  });

  loop.start();
}

main().catch((err) => {
  console.error(err);
});
