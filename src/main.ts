// Bootstrap: build the world state, the renderer, and the fixed-timestep loop,
// then wire them together. Phase 0 has no systems yet — update() only advances
// the sim clock. Phase 1 adds input, spawning, movement, weapons here.

import { Loop } from "./core/loop";
import { Input } from "./core/input";
import { createGameState } from "./state/gameState";
import { Renderer } from "./views/renderer";
import { PerfOverlay } from "./views/perfOverlay";
import { updateSpawn } from "./systems/spawn";
import { updatePlayer, updateEnemies } from "./systems/movement";
import { rebuildHash } from "./systems/broadphase";

const SEED = 0x5eed; // fixed seed → reproducible runs (debugging)

async function main(): Promise<void> {
  const appEl = document.getElementById("app");
  const perfEl = document.getElementById("perf");
  if (!appEl || !perfEl) throw new Error("missing #app or #perf element");

  const state = createGameState(SEED);

  const input = new Input();
  input.attach();

  const renderer = new Renderer();
  await renderer.init(appEl);

  const overlay = new PerfOverlay(perfEl);

  const loop = new Loop({
    update: (dt) => {
      updateSpawn(state); // ramp the swarm to target
      updatePlayer(state, input, dt); // WASD
      updateEnemies(state, dt); // seek the player
      rebuildHash(state); // register every enemy in the broadphase
      state.time += dt;
      state.tick++;
    },
    render: (alpha) => {
      renderer.render(state, alpha);
      overlay.update(loop, 1 / 60, state.enemies.count);
    },
  });

  loop.start();
}

main().catch((err) => {
  console.error(err);
});
