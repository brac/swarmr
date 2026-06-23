// Dumb view. Reads GameState and draws it. Holds no gameplay logic and makes no
// decisions. Owns the Pixi Application and the letterbox transform: the world is
// authored at a fixed WORLD_W x WORLD_H and scaled-to-fit with letterbox bars, so
// gameplay math never depends on window size — only this final transform does.

import {
  Application,
  BitmapText,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
} from "pixi.js";
import type { Texture } from "pixi.js";
import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { ENEMY } from "../data/enemies";
import { DAGGER, WHIP, GARLIC } from "../data/weapons";
import type { Projectiles } from "../state/projectiles";
import { PROJECTILE_CAPACITY, PROJ_AXE } from "../state/projectiles";
import { DAMAGE_NUMBER_CAPACITY, DN_TTL } from "../state/damageNumbers";
import { WHIP_STRIKE_CAPACITY } from "../state/whipStrikes";

// Where inactive pooled particles sit — well outside the 1920x1080 world so they
// never draw. Position is dynamic, so parking here is a cheap per-frame write.
const OFFSCREEN = -10000;

// Crit damage numbers: bigger and red so they read instantly over the swarm.
const DN_CRIT_COLOR = 0xff4040;
const DN_CRIT_SCALE = 1.6;

/**
 * Pack an 0xRRGGBB color (with full alpha) into Particle.color's wire format:
 * 0xAABBGGRR. We write `particle.color` directly rather than `particle.tint`,
 * because the tint setter runs Color.shared.setValue() — which allocates, and at
 * 2,000 enemies × 60fps that churn is what turns the heap into a sawtooth.
 */
function packParticleColor(rgb: number): number {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  return (0xff << 24) | (b << 16) | (g << 8) | r;
}

/**
 * Lerp two 0xRRGGBB colors and return the result already packed for
 * Particle.color (0xAABBGGRR, full alpha). t=0 → a, t=1 → b. Allocation-free.
 */
function lerpParticleColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const r = (ar + (((b >> 16) & 0xff) - ar) * t) | 0;
  const g = (ag + (((b >> 8) & 0xff) - ag) * t) | 0;
  const bl = (ab + ((b & 0xff) - ab) * t) | 0;
  return (0xff << 24) | (bl << 16) | (g << 8) | r;
}

export class Renderer {
  readonly app = new Application();
  /** Everything in world space lives under here; we scale/position it to fit. */
  private world = new Container();
  private playerDot = new Graphics();
  private garlicAura = new Graphics(); // persistent damage aura around the player
  private shownGod = false; // last-applied god-mode tint state (gate the tint write)

  // Swarm layer: one batched container, one shared texture, a fixed pool of
  // particles. Scale lives in the (static) vertex property, so it's baked once
  // at full size; only `position` is dynamic. Active enemies (packed in
  // [0,count)) get real positions; inactive ones are parked off-screen.
  private enemyContainer!: ParticleContainer;
  private enemyParticles: Particle[] = [];
  private enemyHigh = 0; // high-water count, to know how many to park off-screen

  // Projectile (Dagger) layer: same pooled-particle pattern, its own texture/tint.
  private projContainer!: ParticleContainer;
  private projParticles: Particle[] = [];
  private projHigh = 0;

  // Axe layer: distinct blade texture that tumbles (rotation is dynamic). Axes
  // live in the same projectile SoA as daggers; we route by kind into this pool.
  private axeContainer!: ParticleContainer;
  private axeParticles: Particle[] = [];
  private axeHigh = 0;

  // Whip strikes: a small pool of wedge Graphics, each drawn once at the canonical
  // aim (pointing +x). Per active strike we set position/rotation/alpha — no
  // per-frame geometry rebuild. Inactive ones are hidden.
  private whipLayer = new Container();
  private whipGraphics: Graphics[] = [];
  private whipHigh = 0;

  // Damage numbers: pooled BitmapText (one shared dynamic bitmap font → batched
  // glyphs, no per-number texture allocation). `shownValue` lets us skip glyph
  // re-layout — we only set `.text` when a slot's value actually changes.
  private dnLayer = new Container();
  private dnTexts: BitmapText[] = [];
  private dnShownValue: number[] = [];
  private dnShownCrit: number[] = []; // last-applied crit style per slot (gate tint/scale)
  private dnHigh = 0;

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x0b0d12,
      antialias: true,
      resizeTo: parent,
      // Pin WebGL: it's fully supported, handles the swarm, and is our baseline
      // target. WebGPU + v8's experimental ParticleContainer is unverified here;
      // revisit once we want to measure it.
      preference: "webgl",
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    parent.appendChild(this.app.canvas);

    // Static world backdrop: bounds border + center crosshair. Proves the
    // letterbox transform maps world coords correctly. Removed once real art
    // exists; cheap to keep as a debug frame for now.
    const frame = new Graphics();
    frame
      .rect(0, 0, WORLD_W, WORLD_H)
      .fill(0x12151d)
      .rect(0, 0, WORLD_W, WORLD_H)
      .stroke({ width: 2, color: 0x2a3142 });
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;
    frame
      .moveTo(cx - 20, cy)
      .lineTo(cx + 20, cy)
      .moveTo(cx, cy - 20)
      .lineTo(cx, cy + 20)
      .stroke({ width: 1, color: 0x2a3142 });

    this.playerDot.circle(0, 0, 16).fill(0x8fff8f);

    // Garlic aura: a faint greenish disc with a soft ring, drawn once at origin
    // and moved to the player each frame. Alpha pulses gently for an "aura" feel.
    this.garlicAura
      .circle(0, 0, GARLIC.radius)
      .fill({ color: 0x88ff88, alpha: 0.06 })
      .circle(0, 0, GARLIC.radius)
      .stroke({ width: 2, color: 0x88ff88, alpha: 0.25 });

    // Grey-box textures: white circles tinted per particle. One shared base
    // texture per layer = one batch. Real art swaps these for atlas frames later.
    const enemyTex: Texture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, ENEMY.radius).fill(0xffffff),
    );
    const projTex: Texture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, DAGGER.projectileRadius).fill(0xffffff),
    );

    // Enemy pool: color + vertex dynamic so each enemy can flash and scale-punch
    // on hit (position is always dynamic). Base tint comes from data.
    const enemy = this.buildParticlePool(enemyTex, ENEMY.color, ENEMY.capacity, {
      position: true,
      color: true,
      vertex: true,
    });
    this.enemyContainer = enemy.container;
    this.enemyParticles = enemy.particles;

    const proj = this.buildParticlePool(projTex, 0xffe066, PROJECTILE_CAPACITY);
    this.projContainer = proj.container;
    this.projParticles = proj.particles;

    // Axe: a steel blade (rectangle) that tumbles. Position + rotation dynamic.
    const axeTex: Texture = this.app.renderer.generateTexture(
      new Graphics().rect(-15, -6, 30, 12).fill(0xffffff),
    );
    const axe = this.buildParticlePool(axeTex, 0xbcd6ff, PROJECTILE_CAPACITY, {
      position: true,
      rotation: true,
    });
    this.axeContainer = axe.container;
    this.axeParticles = axe.particles;

    // Pooled whip wedges. Each draws the same sector once (apex at origin,
    // pointing +x, spanning ±arcHalfAngle out to range). At swing time we just
    // place + rotate + fade one.
    for (let i = 0; i < WHIP_STRIKE_CAPACITY; i++) {
      const g = new Graphics();
      g.moveTo(0, 0)
        .arc(0, 0, WHIP.range, -WHIP.arcHalfAngle, WHIP.arcHalfAngle)
        .lineTo(0, 0)
        .fill({ color: 0xbfe3ff, alpha: 0.22 });
      g.visible = false;
      this.whipGraphics.push(g);
      this.whipLayer.addChild(g);
    }

    // Pooled damage-number text objects (hidden until used).
    for (let i = 0; i < DAMAGE_NUMBER_CAPACITY; i++) {
      const bt = new BitmapText({
        text: "",
        style: {
          fontFamily: "monospace",
          fontSize: 30,
          fontWeight: "bold",
          fill: 0xffffff,
        },
      });
      bt.anchor.set(0.5);
      bt.visible = false;
      this.dnTexts.push(bt);
      this.dnShownValue.push(-1);
      this.dnShownCrit.push(-1);
      this.dnLayer.addChild(bt);
    }

    // Draw order: backdrop, garlic aura, swarm, whip arcs, projectiles, numbers,
    // player on top. The aura sits under the swarm so enemies wade through it.
    this.world.addChild(
      frame,
      this.garlicAura,
      this.enemyContainer,
      this.whipLayer,
      this.projContainer,
      this.axeContainer,
      this.dnLayer,
      this.playerDot,
    );
    this.app.stage.addChild(this.world);

    // Pixi's own ticker drives nothing — our fixed-timestep Loop owns timing.
    this.app.ticker.stop();

    this.layout();
    window.addEventListener("resize", this.layout);
  }

  /** Scale-to-fit the world into the canvas, centered, with letterbox bars. */
  private layout = (): void => {
    const sw = this.app.renderer.width / (window.devicePixelRatio || 1);
    const sh = this.app.renderer.height / (window.devicePixelRatio || 1);
    const scale = Math.min(sw / WORLD_W, sh / WORLD_H);
    this.world.scale.set(scale);
    this.world.position.set(
      (sw - WORLD_W * scale) / 2,
      (sh - WORLD_H * scale) / 2,
    );
  };

  /** Read state, position views, render one frame. No decisions here. */
  render(state: GameState, _alpha: number): void {
    const p = state.player;
    this.playerDot.position.set(p.pos.x, p.pos.y);
    // Blink while invulnerable (i-frames) so a hit reads instantly; solid otherwise.
    this.playerDot.alpha =
      p.invuln > 0 && ((p.invuln * 20) | 0) % 2 === 0 ? 0.35 : 1;
    // God mode tints the player gold; gated so the tint setter runs only on change.
    if (state.godMode !== this.shownGod) {
      this.playerDot.tint = state.godMode ? 0xffd700 : 0xffffff;
      this.shownGod = state.godMode;
    }

    // Garlic aura follows the player; gentle alpha pulse to read as "active".
    this.garlicAura.position.set(p.pos.x, p.pos.y);
    this.garlicAura.alpha = 0.75 + 0.25 * Math.sin(state.time * 4);

    const e = state.enemies;
    this.enemyHigh = this.syncEnemies(e.count, e.posX, e.posY, e.hitTimer);

    this.syncProjectiles(state.projectiles);

    // Whip strikes: place/rotate/fade each active wedge; hide the rest.
    const ws = state.whipStrikes;
    const wg = this.whipGraphics;
    const wn = ws.count;
    for (let i = 0; i < wn; i++) {
      const g = wg[i]!;
      g.position.set(ws.posX[i]!, ws.posY[i]!);
      g.rotation = ws.angle[i]!;
      g.alpha = 1 - ws.age[i]! / WHIP.strikeTTL;
      g.visible = true;
    }
    for (let i = wn; i < this.whipHigh; i++) wg[i]!.visible = false;
    this.whipHigh = wn;

    // Damage numbers: position + fade by age; set text only when a slot's value
    // changed (swap-remove can move a different number into a slot).
    const dn = state.damageNumbers;
    const texts = this.dnTexts;
    const shown = this.dnShownValue;
    const shownCrit = this.dnShownCrit;
    const n = dn.count;
    for (let i = 0; i < n; i++) {
      const bt = texts[i]!;
      const v = dn.value[i]!;
      if (shown[i] !== v) {
        bt.text = "" + v;
        shown[i] = v;
      }
      bt.x = dn.posX[i]!;
      bt.y = dn.posY[i]!;
      bt.alpha = 1 - dn.age[i]! / DN_TTL;
      // Crits read bigger and red; normal hits stay white at base size. Gated:
      // the tint setter parses a Color, so only touch it when the style changes.
      const crit = dn.crit[i]!;
      if (shownCrit[i] !== crit) {
        if (crit === 1) {
          bt.tint = DN_CRIT_COLOR;
          bt.scale.set(DN_CRIT_SCALE);
        } else {
          bt.tint = 0xffffff;
          bt.scale.set(1);
        }
        shownCrit[i] = crit;
      }
      bt.visible = true;
    }
    for (let i = n; i < this.dnHigh; i++) texts[i]!.visible = false;
    this.dnHigh = n;

    this.app.renderer.render(this.app.stage);
  }

  /**
   * Build a pooled ParticleContainer: capacity particles parked off-screen.
   * `dynamic` picks which per-particle buffers get re-uploaded each frame. The
   * swarm enables color + vertex (for hit-flash tint and the scale punch); the
   * projectile pool stays position-only and leaves the rest baked once.
   */
  private buildParticlePool(
    tex: Texture,
    tint: number,
    capacity: number,
    dynamic: {
      position?: boolean;
      color?: boolean;
      vertex?: boolean;
      rotation?: boolean;
    } = { position: true },
  ): { container: ParticleContainer; particles: Particle[] } {
    const particles: Particle[] = [];
    for (let i = 0; i < capacity; i++) {
      particles.push(
        new Particle({
          texture: tex,
          tint,
          anchorX: 0.5,
          anchorY: 0.5,
          x: OFFSCREEN,
          y: OFFSCREEN,
        }),
      );
    }
    const container = new ParticleContainer({
      dynamicProperties: dynamic,
      texture: tex,
      particles,
    });
    // Build static buffers once, else quads render zero-size.
    container.update();
    return { container, particles };
  }

  /**
   * Sync the swarm particles: position always, plus hit-react flash (tint lerps
   * from the flash color back to base) and a scale punch, both driven by each
   * enemy's hitTimer. Parks the rest off-screen. Returns the new high-water mark.
   */
  private syncEnemies(
    count: number,
    posX: Float32Array,
    posY: Float32Array,
    hitTimer: Float32Array,
  ): number {
    const particles = this.enemyParticles;
    const base = ENEMY.color;
    const flash = ENEMY.hitFlashColor;
    const basePacked = packParticleColor(base); // precompute the no-flash color once
    const reactInv = 1 / ENEMY.hitReactTime;
    const wobble = ENEMY.hitWobble;

    for (let i = 0; i < count; i++) {
      const p = particles[i]!;
      p.x = posX[i]!;
      p.y = posY[i]!;
      const ht = hitTimer[i]!;
      if (ht > 0) {
        const t = ht * reactInv; // 1 at impact → 0 as it decays
        p.color = lerpParticleColor(base, flash, t);
        const s = 1 + wobble * t;
        p.scaleX = s;
        p.scaleY = s;
      } else {
        p.color = basePacked;
        p.scaleX = 1;
        p.scaleY = 1;
      }
    }
    for (let i = count; i < this.enemyHigh; i++) {
      const p = particles[i]!;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
    }
    return count;
  }

  /**
   * Route the mixed projectile SoA into its two visual pools by kind: daggers to
   * the projectile pool, axes to the spinning blade pool (with rotation). Parks
   * each pool's leftovers off-screen.
   */
  private syncProjectiles(pr: Projectiles): void {
    const daggerP = this.projParticles;
    const axeP = this.axeParticles;
    const posX = pr.posX;
    const posY = pr.posY;
    const spin = pr.spin;
    const kind = pr.kind;
    const n = pr.count;
    let dN = 0;
    let aN = 0;
    for (let i = 0; i < n; i++) {
      if (kind[i] === PROJ_AXE) {
        const p = axeP[aN++]!;
        p.x = posX[i]!;
        p.y = posY[i]!;
        p.rotation = spin[i]!;
      } else {
        const p = daggerP[dN++]!;
        p.x = posX[i]!;
        p.y = posY[i]!;
      }
    }
    for (let i = dN; i < this.projHigh; i++) {
      const p = daggerP[i]!;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
    }
    for (let i = aN; i < this.axeHigh; i++) {
      const p = axeP[i]!;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
    }
    this.projHigh = dN;
    this.axeHigh = aN;
  }
}
