// Bootstrap: build the world state, the renderer, and the fixed-timestep loop,
// then wire them together. update() runs the systems in a fixed order each tick;
// render() draws the current state. The world is a single mutable object — on
// death we throw it away and build a fresh one (restart).

import { Loop } from "./core/loop";
import { Input } from "./core/input";
import { createGameState } from "./state/gameState";
import { Renderer } from "./views/renderer";
import { PerfOverlay } from "./views/perfOverlay";
import { Hud } from "./views/hud";
import { updateSpawn } from "./systems/spawn";
import { updatePlayer, updateEnemies } from "./systems/movement";
import { rebuildHash } from "./systems/broadphase";
import { updateContact } from "./systems/contactDamage";
import { updateDagger } from "./systems/weapons/dagger";
import { updateWhip } from "./systems/weapons/whip";
import { updateGarlic } from "./systems/weapons/garlic";
import { updateAxe } from "./systems/weapons/axe";
import { updateProjectiles } from "./systems/projectiles";
import { updateCollision } from "./systems/collision";
import { updateGems } from "./systems/gems";
import { updateDamageNumbers } from "./systems/damageNumbers";

const SEED = 0x5eed; // fixed seed → reproducible runs (debugging)

async function main(): Promise<void> {
  const appEl = document.getElementById("app");
  const perfEl = document.getElementById("perf");
  const hpFillEl = document.getElementById("hpfill");
  const hpTextEl = document.getElementById("hptext");
  const xpFillEl = document.getElementById("xpfill");
  const levelEl = document.getElementById("level");
  const deathEl = document.getElementById("death");
  if (
    !appEl ||
    !perfEl ||
    !hpFillEl ||
    !hpTextEl ||
    !xpFillEl ||
    !levelEl ||
    !deathEl
  ) {
    throw new Error("missing required DOM element (#app/#perf/#hud/#xp/#death)");
  }

  // Reassignable: restart swaps in a brand-new world. The loop/listener closures
  // read this binding each call, so they always see the current world.
  let state = createGameState(SEED);

  const input = new Input();
  input.attach();

  // Restart on R once dead. keydown is edge-triggered; after the swap gameOver is
  // false, so key-repeat events are no-ops until the next death.
  // Debug: L toggles god mode (ignore contact damage), e.g. to test weapons in
  // the swarm without dying.
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyR" && state.gameOver) state = createGameState(SEED);
    else if (e.code === "KeyL" && !e.repeat) {
      state.godMode = !state.godMode;
      console.log("god mode:", state.godMode ? "ON" : "OFF");
    }
  });

  const renderer = new Renderer();
  await renderer.init(appEl);

  const overlay = new PerfOverlay(perfEl);
  const hud = new Hud(
    { fill: hpFillEl, text: hpTextEl },
    { fill: xpFillEl, level: levelEl },
    deathEl,
  );

  const loop = new Loop({
    update: (dt) => {
      if (state.gameOver) return; // freeze the sim; only restart can revive it

      updateSpawn(state); // ramp the swarm to target
      updatePlayer(state, input, dt); // WASD
      updateEnemies(state, dt); // seek the player
      rebuildHash(state); // register every enemy (positions now final this tick)
      updateContact(state, dt); // enemies touching the player deal damage (i-frames)
      updateDagger(state, dt); // auto-fire at nearest enemy (queries the hash)
      updateWhip(state, dt); // sweep an arc; area-overlap damage (before collision)
      updateGarlic(state); // persistent aura; per-enemy re-hit cooldown (before collision)
      updateAxe(state, dt); // lob gravity axes upward (pooled projectiles)
      updateProjectiles(state, dt); // travel + lifetime (gravity arcs the axes)
      updateCollision(state); // projectile↔enemy, damage, deaths, gem drops
      updateGems(state, dt); // magnet + pickup + leveling
      updateDamageNumbers(state, dt); // float + fade + expire
      if (state.levelUpTimer > 0) state.levelUpTimer -= dt;
      state.time += dt;
      state.tick++;
    },
    render: (alpha) => {
      renderer.render(state, alpha);
      overlay.update(loop, 1 / 60, state.enemies.count);
      hud.update(state, 1 / 60);
    },
  });

  loop.start();
}

main().catch((err) => {
  console.error(err);
});
