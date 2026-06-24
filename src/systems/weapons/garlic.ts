// REDESIGN (side-scroller): a player-centered aura is a poor fit now that threats
// only come from the right — rethink as a forward cone / wall / trailing hazard.
// See BACKLOG.md "Side-scroller weapon redesigns".
//
// Garlic — weapon three. The lesson it forces: a damage cooldown *per entity*.
// Unlike the Dagger/Whip (which fire on a global cooldown), garlic is an always-on
// aura. Every enemy inside the radius takes damage, but each enemy carries its own
// next-eligible timestamp (garlicNextHit): once hit, it can't be hit again until
// rehitCooldown has passed. That staggered per-enemy cadence — not a global pulse —
// is the DoT pattern reused by every future zone/aura/poison effect.
//
// Implementing the cooldown as an absolute sim-time stamp (vs a countdown) means no
// per-tick decrement pass over all enemies: we just compare against state.time.
//
// Like the Whip, garlic only subtracts HP; collision's end-of-tick compaction
// sweeps the dead, so this must run before collision (indices stay valid here).

import type { GameState } from "../../state/gameState";
import { GARLIC } from "../../data/weapons";
import { ENEMY } from "../../data/enemies";
import { BOSS } from "../../data/boss";
import { rollHit } from "../combat";
import { damageBoss } from "../boss";

export function updateGarlic(state: GameState): void {
  const g = state.weapons.garlic;
  const now = state.time;

  // Black Aura tendrils fade out on sim-time; age any that exist every tick (even
  // when the aura touches nothing, or the weapon was just toggled off).
  if (state.tendrils.count > 0) ageTendrils(state, now);

  if (g.level < 1) return; // not acquired — no aura damage
  const e = state.enemies;
  if (e.count === 0) return;

  const h = state.hash;
  const px = state.player.pos.x;
  const py = state.player.pos.y;

  // Global AoE passive scales the aura. Derive the effective radius once so every
  // query below (bounds + distance test) and the renderer's aura visual agree —
  // the renderer multiplies the same garlic radius by aoeMult on its scale line.
  const auraRadius = g.radius * state.passives.aoeMult;
  // Global Damage passive folds into garlic's per-hit damage.
  const damage = g.damage * state.passives.damageMult;
  const r2 = auraRadius * auraRadius;
  // Black Aura re-ticks faster (radius/damage are already folded into the live
  // stats on evolve; see upgrades.ts).
  const rehit = g.evolved ? GARLIC.evo.rehitCooldown : GARLIC.rehitCooldown;

  const cxLo = h.clampCX(px - auraRadius);
  const cxHi = h.clampCX(px + auraRadius);
  const cyLo = h.clampCY(py - auraRadius);
  const cyHi = h.clampCY(py + auraRadius);

  const posX = e.posX;
  const posY = e.posY;
  const hp = e.hp;
  const hitTimer = e.hitTimer;
  const nextHit = e.garlicNextHit;
  const radius = e.radius; // per-enemy radius array
  const cellStart = h.cellStart;
  const items = h.items;
  const gridW = h.gridW;

  for (let gy = cyLo; gy <= cyHi; gy++) {
    const rowBase = gy * gridW;
    for (let gx = cxLo; gx <= cxHi; gx++) {
      const c = rowBase + gx;
      const end = cellStart[c + 1]!;
      for (let pp = cellStart[c]!; pp < end; pp++) {
        const j = items[pp]!;
        if (hp[j]! <= 0) continue; // already dead this tick
        if (now < nextHit[j]!) continue; // per-enemy cooldown still ticking
        const dx = posX[j]! - px;
        const dy = posY[j]! - py;
        if (dx * dx + dy * dy > r2) continue; // outside the aura

        const roll = rollHit(state.rng, damage);
        hp[j]! -= roll.amount;
        hitTimer[j] = ENEMY.hitReactTime;
        state.damageNumbers.spawn(
          posX[j]!,
          posY[j]! - radius[j]!,
          roll.amount,
          roll.crit ? 1 : 0,
        );
        nextHit[j] = now + rehit;
        // Flick a tendril from the player out to the struck enemy.
        if (g.evolved) spawnTendril(state, px, py, posX[j]!, posY[j]!, now);
      }
    }
  }

  // Boss (outside the hash): tick it if it's inside the aura and off cooldown.
  const b = state.boss;
  if (b.active && now >= b.garlicNextHit) {
    const dx = b.pos.x - px;
    const dy = b.pos.y - py;
    const reach = auraRadius + BOSS.radius; // scaled aura reaches the boss too
    if (dx * dx + dy * dy <= reach * reach) {
      damageBoss(state, damage);
      b.garlicNextHit = now + BOSS.garlicCooldown;
      if (g.evolved) spawnTendril(state, px, py, b.pos.x, b.pos.y, now);
    }
  }
}

// Flick a tendril visual from the player (ox,oy) out to a struck target (tx,ty).
function spawnTendril(
  state: GameState,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  now: number,
): void {
  const dx = tx - ox;
  const dy = ty - oy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  state.tendrils.spawn(ox, oy, Math.atan2(dy, dx), len, now);
}

// Retire tendrils whose lifetime has elapsed (sim-time keyed, no dt needed).
function ageTendrils(state: GameState, now: number): void {
  const t = state.tendrils;
  const ttl = GARLIC.evo.tendrilTTL;
  for (let i = t.count - 1; i >= 0; i--) {
    if (now - t.born[i]! >= ttl) t.kill(i);
  }
}
