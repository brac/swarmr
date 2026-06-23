// Dumb view. Reads GameState and draws it. Holds no gameplay logic and makes no
// decisions. Owns the Pixi Application and the letterbox transform: the world is
// authored at a fixed WORLD_W x WORLD_H and scaled-to-fit with letterbox bars, so
// gameplay math never depends on window size — only this final transform does.

import {
  Application,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
} from "pixi.js";
import type { Texture } from "pixi.js";
import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";
import { ENEMY } from "../data/enemies";

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

    // Grey-box enemy texture: a white circle, tinted per particle. Single shared
    // base texture = one batch. Real art swaps this for an atlas frame later.
    const enemyTex: Texture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, ENEMY.radius).fill(0xffffff),
    );
    const parts: Particle[] = [];
    for (let i = 0; i < ENEMY.capacity; i++) {
      parts.push(
        new Particle({
          texture: enemyTex,
          tint: 0xff5566,
          anchorX: 0.5,
          anchorY: 0.5,
          // Start parked off-screen; render() moves the active ones in.
          x: OFFSCREEN,
          y: OFFSCREEN,
        }),
      );
    }
    this.enemyParticles = parts;
    this.enemyContainer = new ParticleContainer({
      // Only position changes per frame; scale/color stay static (and fast).
      dynamicProperties: { position: true },
      texture: enemyTex,
      particles: parts,
    });
    // REQUIRED: build the static buffers (vertex/scale, uvs, color). Without this
    // the vertex buffer is never uploaded and every quad renders at zero size.
    this.enemyContainer.update();

    // Draw order: backdrop, swarm, then player on top.
    this.world.addChild(frame, this.enemyContainer, this.playerDot);
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
    const parts = this.enemyParticles;
    const n = e.count;
    for (let i = 0; i < n; i++) {
      const p = parts[i]!;
      p.x = e.posX[i]!;
      p.y = e.posY[i]!;
    }
    // Park any that were active last frame but aren't now.
    for (let i = n; i < this.enemyHigh; i++) {
      const p = parts[i]!;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
    }
    this.enemyHigh = n;

    this.app.renderer.render(this.app.stage);
  }
}
