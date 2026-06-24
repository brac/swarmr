// Bootstrap: build the world state, the renderer, and the fixed-timestep loop,
// then wire them together. update() runs the systems in a fixed order each tick;
// render() draws the current state. The world is a single mutable object — on
// death we throw it away and build a fresh one (restart).

import { Loop } from "./core/loop";
import { Input } from "./core/input";
import { Audio } from "./core/audio";
import { createGameState } from "./state/gameState";
import { Renderer } from "./views/renderer";
import { PerfOverlay } from "./views/perfOverlay";
import { Hud } from "./views/hud";
import { UpgradeMenu } from "./views/upgradeMenu";
import { DevMenu } from "./views/devMenu";
import { rollUpgrades } from "./systems/upgrades";
import { levelUp, levelDown } from "./systems/gems";
import { updateSpawn } from "./systems/spawn";
import { updatePlayer, updateEnemies } from "./systems/movement";
import { rebuildHash } from "./systems/broadphase";
import { updateContact } from "./systems/contactDamage";
import { updateBoss, spawnBoss } from "./systems/boss";
import { updateDagger } from "./systems/weapons/dagger";
import { updateWhip } from "./systems/weapons/whip";
import { updateGarlic } from "./systems/weapons/garlic";
import { updateAxe } from "./systems/weapons/axe";
import { updateLaser } from "./systems/weapons/laser";
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
  const timerEl = document.getElementById("timer");
  const killsEl = document.getElementById("kills");
  const bossWrapEl = document.getElementById("bossbar");
  const bossFillEl = document.getElementById("bossfill");
  const winEl = document.getElementById("win");
  const winStatsEl = document.getElementById("winstats");
  const deathEl = document.getElementById("death");
  const upgradesEl = document.getElementById("upgrades");
  const titleEl = document.getElementById("title");
  const pauseEl = document.getElementById("pause");
  if (
    !appEl ||
    !perfEl ||
    !hpFillEl ||
    !hpTextEl ||
    !xpFillEl ||
    !levelEl ||
    !timerEl ||
    !killsEl ||
    !bossWrapEl ||
    !bossFillEl ||
    !winEl ||
    !winStatsEl ||
    !deathEl ||
    !upgradesEl ||
    !titleEl ||
    !pauseEl
  ) {
    throw new Error("missing a required DOM element (HUD/overlays)");
  }

  // Reassignable: restart swaps in a brand-new world. The loop/listener closures
  // read this binding each call, so they always see the current world.
  let state = createGameState(SEED);

  const input = new Input();
  input.attach();

  const audio = new Audio();

  // App lifecycle: title → playing (Esc pause) → death/win → restart into play.
  // These gate the sim; render keeps running so overlays draw over a frozen scene.
  let started = false;
  let paused = false;

  const startGame = (): void => {
    if (started) return;
    started = true;
    titleEl.style.display = "none";
  };
  const setPaused = (v: boolean): void => {
    paused = v;
    pauseEl.style.display = v ? "flex" : "none";
  };

  // Click the title to begin (any key also works, below).
  titleEl.addEventListener("click", startGame);

  // Debug keys (edge-triggered; key-repeat ignored):
  //   R  restart (when dead/won)    L  toggle god mode (no contact damage)
  //   K  toggle XP leveling         ]  +1 level (opens upgrade menu)
  //   [  -1 level                   B  spawn the boss now    M  mute
  //   `  toggle dev menu (weapon stages)
  window.addEventListener("keydown", (e) => {
    // Dev menu toggles regardless of run state (handy on the title screen too).
    if (e.code === "Backquote" && !e.repeat) {
      devMenu.toggle();
      return;
    }
    // Any key starts the run from the title screen.
    if (!started) {
      startGame();
      return;
    }
    // Esc pauses / resumes during play.
    if (e.code === "Escape" && !state.gameOver && !state.won) {
      setPaused(!paused);
      return;
    }
    if (e.code === "KeyR" && (state.gameOver || state.won)) {
      state = createGameState(SEED);
      setPaused(false);
    } else if (e.code === "KeyB" && !e.repeat && !state.gameOver && !state.won) {
      spawnBoss(state);
    } else if (e.code === "KeyL" && !e.repeat) {
      state.godMode = !state.godMode;
      console.log("god mode:", state.godMode ? "ON" : "OFF");
    } else if (e.code === "KeyM" && !e.repeat) {
      console.log("muted:", audio.toggleMute());
    } else if (e.code === "KeyK" && !e.repeat) {
      state.levelingEnabled = !state.levelingEnabled;
      console.log("leveling:", state.levelingEnabled ? "ON" : "OFF");
    } else if (e.code === "BracketRight" && !e.repeat && !state.gameOver) {
      levelUp(state); // manual +level → upgrade menu, even if leveling is off
    } else if (e.code === "BracketLeft" && !e.repeat && !state.gameOver) {
      levelDown(state);
    }
  });

  const renderer = new Renderer();
  await renderer.init(appEl);

  const overlay = new PerfOverlay(perfEl);
  const hud = new Hud(
    { fill: hpFillEl, text: hpTextEl },
    { fill: xpFillEl, level: levelEl },
    { timer: timerEl, kills: killsEl },
    { wrap: bossWrapEl, fill: bossFillEl },
    { win: winEl, winStats: winStatsEl, death: deathEl },
  );

  // Picking an upgrade applies it and clears one queued level-up. If more remain,
  // the render loop re-opens the menu next frame with a fresh roll.
  const upgradeMenu = new UpgradeMenu(upgradesEl, (u) => {
    u.apply(state);
    // A weapon's stat pick advances its level toward the evolution unlock; the
    // evolution pick itself flips `evolved` in apply() and ends the line.
    if (u.weapon && u.kind === "stat") state.weapons[u.weapon].level++;
    state.levelUpsPending--;
  });

  // Dev menu (backtick): set any weapon to base / +1 / max / evolved on the fly.
  const devMenu = new DevMenu(
    () => state,
    { spawnBoss: () => spawnBoss(state), levelUp: () => levelUp(state) },
  );

  const loop = new Loop({
    update: (dt) => {
      if (!started || paused) return; // title screen / Esc pause
      if (state.gameOver || state.won) return; // frozen on the end screen
      if (state.levelUpsPending > 0) return; // paused while choosing an upgrade

      updateSpawn(state); // ramp the swarm to target
      updatePlayer(state, input, dt); // WASD
      updateEnemies(state, dt); // seek the player
      rebuildHash(state); // register every enemy (positions now final this tick)
      updateContact(state, dt); // enemies touching the player deal damage (i-frames)
      updateBoss(state, dt); // arrive at the deadline, seek, contact (before weapons)
      updateDagger(state, dt); // auto-fire at nearest enemy (queries the hash)
      updateWhip(state, dt); // sweep an arc; area-overlap damage (before collision)
      updateGarlic(state); // persistent aura; per-enemy re-hit cooldown (before collision)
      updateLaser(state, dt); // sustained beam along player facing; line hitbox (before collision)
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
      audio.update(state, 1 / 60);
      // Open the upgrade menu for each queued level-up (sim is paused meanwhile).
      if (!state.gameOver && state.levelUpsPending > 0 && !upgradeMenu.isOpen()) {
        upgradeMenu.show(rollUpgrades(state, 3));
      }
    },
  });

  loop.start();
}

main().catch((err) => {
  console.error(err);
});
