// Dumb view. Reads GameState and draws it. Holds no gameplay logic and makes no
// decisions. Owns the Pixi Application and the letterbox transform: the world is
// authored at a fixed WORLD_W x WORLD_H and scaled-to-fit with letterbox bars, so
// gameplay math never depends on window size — only this final transform does.

import { Application, Container, Graphics } from "pixi.js";
import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H } from "../state/gameState";

export class Renderer {
  readonly app = new Application();
  /** Everything in world space lives under here; we scale/position it to fit. */
  private world = new Container();
  private playerDot = new Graphics();

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x0b0d12,
      antialias: true,
      resizeTo: parent,
      preference: "webgpu", // falls back to webgl automatically
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

    this.world.addChild(frame, this.playerDot);
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
    this.app.renderer.render(this.app.stage);
  }
}
