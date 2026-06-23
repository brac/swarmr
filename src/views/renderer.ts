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
import { DAGGER } from "../data/weapons";
import { PROJECTILE_CAPACITY } from "../state/projectiles";
import { DAMAGE_NUMBER_CAPACITY, DN_TTL } from "../state/damageNumbers";

// Where inactive pooled particles sit — well outside the 1920x1080 world so they
// never draw. Position is dynamic, so parking here is a cheap per-frame write.
const OFFSCREEN = -10000;

export class Renderer {
  readonly app = new Application();
  /** Everything in world space lives under here; we scale/position it to fit. */
  private world = new Container();
  private playerDot = new Graphics();

  // Swarm layer: one batched container, one shared texture, a fixed pool of
  // particles. Scale lives in the (static) vertex property, so it's baked once
  // at full size; only `position` is dynamic. Active enemies (packed in
  // [0,count)) get real positions; inactive ones are parked off-screen.
  private enemyContainer!: ParticleContainer;
  private enemyParticles: Particle[] = [];
  private enemyHigh = 0; // high-water count, to know how many to park off-screen

  // Projectile layer: same pooled-particle pattern, its own texture/tint.
  private projContainer!: ParticleContainer;
  private projParticles: Particle[] = [];
  private projHigh = 0;

  // Damage numbers: pooled BitmapText (one shared dynamic bitmap font → batched
  // glyphs, no per-number texture allocation). `shownValue` lets us skip glyph
  // re-layout — we only set `.text` when a slot's value actually changes.
  private dnLayer = new Container();
  private dnTexts: BitmapText[] = [];
  private dnShownValue: number[] = [];
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

    // Grey-box textures: white circles tinted per particle. One shared base
    // texture per layer = one batch. Real art swaps these for atlas frames later.
    const enemyTex: Texture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, ENEMY.radius).fill(0xffffff),
    );
    const projTex: Texture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, DAGGER.projectileRadius).fill(0xffffff),
    );

    const enemy = this.buildParticlePool(enemyTex, 0xff5566, ENEMY.capacity);
    this.enemyContainer = enemy.container;
    this.enemyParticles = enemy.particles;

    const proj = this.buildParticlePool(projTex, 0xffe066, PROJECTILE_CAPACITY);
    this.projContainer = proj.container;
    this.projParticles = proj.particles;

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
      this.dnLayer.addChild(bt);
    }

    // Draw order: backdrop, swarm, projectiles, damage numbers, player on top.
    this.world.addChild(
      frame,
      this.enemyContainer,
      this.projContainer,
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
    this.playerDot.position.set(state.player.pos.x, state.player.pos.y);

    const e = state.enemies;
    this.enemyHigh = this.syncParticles(
      this.enemyParticles,
      this.enemyHigh,
      e.count,
      e.posX,
      e.posY,
    );

    const pr = state.projectiles;
    this.projHigh = this.syncParticles(
      this.projParticles,
      this.projHigh,
      pr.count,
      pr.posX,
      pr.posY,
    );

    // Damage numbers: position + fade by age; set text only when a slot's value
    // changed (swap-remove can move a different number into a slot).
    const dn = state.damageNumbers;
    const texts = this.dnTexts;
    const shown = this.dnShownValue;
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
      bt.visible = true;
    }
    for (let i = n; i < this.dnHigh; i++) texts[i]!.visible = false;
    this.dnHigh = n;

    this.app.renderer.render(this.app.stage);
  }

  /** Build a pooled ParticleContainer: capacity particles parked off-screen. */
  private buildParticlePool(
    tex: Texture,
    tint: number,
    capacity: number,
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
      dynamicProperties: { position: true },
      texture: tex,
      particles,
    });
    // Build static buffers (scale/uvs/color) once, else quads render zero-size.
    container.update();
    return { container, particles };
  }

  /**
   * Move the first `count` particles to a SoA's positions; park the rest (down
   * to last frame's high-water mark) off-screen. Returns the new high-water mark.
   */
  private syncParticles(
    particles: Particle[],
    high: number,
    count: number,
    posX: Float32Array,
    posY: Float32Array,
  ): number {
    for (let i = 0; i < count; i++) {
      const p = particles[i]!;
      p.x = posX[i]!;
      p.y = posY[i]!;
    }
    for (let i = count; i < high; i++) {
      const p = particles[i]!;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
    }
    return count;
  }
}
