// Fixed-timestep loop. Logic ticks at a fixed rate (240Hz) decoupled from
// render. Gameplay never reads wall-clock delta directly — systems get a
// constant dt. Render gets an interpolation alpha for smoothing between ticks.

export interface LoopCallbacks {
  /** Fixed logic step. dt is constant (see TICK_DT). */
  update: (dt: number) => void;
  /** Render. alpha in [0,1) = fraction into the next pending tick. */
  render: (alpha: number) => void;
}

export const TICK_HZ = 240;
export const TICK_DT = 1 / TICK_HZ;

// Cap how many logic ticks we simulate per frame. If the tab stalls, we drop
// simulated time rather than spiral trying to catch up (spiral-of-death guard).
const MAX_TICKS_PER_FRAME = 8;

export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;

  // Perf instrumentation, read by the overlay.
  updateMs = 0;
  renderMs = 0;
  fps = 0;
  ticksLastFrame = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(private cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;

    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp pathological frame gaps (alt-tab, breakpoint) to avoid a flood.
    if (frameTime > 0.25) frameTime = 0.25;

    this.accumulator += frameTime;

    // --- fixed logic ticks ---
    let ticks = 0;
    const t0 = performance.now();
    while (this.accumulator >= TICK_DT && ticks < MAX_TICKS_PER_FRAME) {
      this.cb.update(TICK_DT);
      this.accumulator -= TICK_DT;
      ticks++;
    }
    // If we hit the tick cap, shed the backlog so we don't spiral next frame.
    if (ticks >= MAX_TICKS_PER_FRAME) this.accumulator = 0;
    this.updateMs = performance.now() - t0;
    this.ticksLastFrame = ticks;

    // --- render with interpolation alpha ---
    const alpha = this.accumulator / TICK_DT;
    const r0 = performance.now();
    this.cb.render(alpha);
    this.renderMs = performance.now() - r0;

    // --- fps (1s rolling) ---
    this.fpsAccum += frameTime;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.rafId = requestAnimationFrame(this.frame);
  };
}
