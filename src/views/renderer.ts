// Dumb view. Reads GameState and draws it. Holds no gameplay logic and makes no
// decisions. Owns the Pixi Application and the letterbox transform: the world is
// authored at a fixed WORLD_W x WORLD_H and scaled-to-fit with letterbox bars, so
// gameplay math never depends on window size — only this final transform does.

import {
  Application,
  Assets,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
  Text,
} from "pixi.js";
import type { GameState } from "../state/gameState";
import { WORLD_W, WORLD_H, MAX_LASER_SEGMENTS } from "../state/gameState";
import { ENEMY } from "../data/enemies";
import { PLAYER } from "../data/player";
import { DAGGER, WHIP, AXE, LASER } from "../data/weapons";
import { ULTIMATE } from "../data/ultimate";
import { XP, LEVEL } from "../data/xp";
import { BOSS } from "../data/boss";
import type { Enemies } from "../state/enemies";
import type { Projectiles } from "../state/projectiles";
import { PROJECTILE_CAPACITY, PROJ_AXE, PROJ_LIGHT } from "../state/projectiles";
import type { DamageNumbers } from "../state/damageNumbers";
import { DAMAGE_NUMBER_CAPACITY, DN_TTL } from "../state/damageNumbers";

// Where inactive pooled particles sit — well outside the 1920x1080 world so they
// never draw. Position is dynamic, so parking here is a cheap per-frame write.
const OFFSCREEN = -10000;
const FLOOR_SCROLL_SPEED = 200; // px/sec the floor drifts left → reads as forward travel

// Crit damage numbers: bigger and red so they read instantly over the swarm.
const DN_CRIT_COLOR = 0xff4040;
const DN_CRIT_SCALE = 1.6;
const DN_MAX_DIGITS = 4; // up to 9999 per number; caps the digit-sprite pool size
// Reused scratch for extracting a number's digits (least-significant first).
const digitScratch = new Int32Array(DN_MAX_DIGITS);

// Sprite atlas (Kenney-style tilemap): 16px tiles, 12 columns, no gaps. Tile
// indices for the things we draw. Enemy frames are ordered by ENEMY_TYPES index.
const TILE = 16;
const ATLAS_COLS = 12;
const TILEMAP = "assets/Tilemap/tilemap_packed.png";
const FLOOR_TILE = "assets/Tiles/tile_0048.png"; // standalone (no atlas-seam bleed)
const T_PLAYER = 98;
// One atlas tile per ENEMY_TYPES index (order is load-bearing — see data/enemies):
// grunt=slime, runner=spider, tank=orc, goblin, biter=crab, carapace=beetle,
// hellhound=red-eyed beast, serpent=coiled snake.
const T_ENEMY = [108, 122, 109, 112, 110, 124, 111, 123];
const T_BOSS = 121; // skull-wraith
const T_DAGGER = 103;
const T_AXE = 118;
const T_SWORD = 104; // blade tile reused for the melee sword (tune in-game)

// A 16px sprite covers ~4× the entity radius (overhang beyond the hitbox reads
// better — characters look chunkier than their collision circle).
const SPRITE_PER_RADIUS = 4 / TILE;
// The dagger art points up; rotate it from that to its travel direction.
const DAGGER_SPRITE_OFFSET = Math.PI / 2;
const FLOOR_TILE_SCALE = 3; // 16px floor tile → 48px on the world grid
const FLOOR_TINT = 0x363c47; // dark slate; multiplies the bright floor tile down

export class Renderer {
  readonly app = new Application();
  /** Everything in world space lives under here; we scale/position it to fit. */
  private world = new Container();
  private floor!: TilingSprite; // scrolls left to sell the side-scroller's forward travel
  private playerSprite = new Sprite();
  private swordSprite = new Sprite(); // melee blade; swings (rotates) while an enemy is in range
  private shownGod = false; // last-applied god-mode tint state (gate the tint write)

  // Swarm: one batched ParticleContainer per enemy type (each its own sprite
  // texture), routed by type in syncEnemies. Position + scale (vertex) are
  // dynamic so each enemy sizes to its radius and scale-punches on hit.
  private enemyPools: {
    container: ParticleContainer;
    particles: Particle[];
    high: number;
  }[] = [];
  // Per-frame write cursor into each enemy pool (one slot per type). Reused and
  // zeroed each frame so routing the swarm by type allocates nothing.
  private enemyCursors: number[] = [];

  // Projectile (Dagger) layer: same pooled-particle pattern, its own texture/tint.
  private projContainer!: ParticleContainer;
  private projParticles: Particle[] = [];
  private projHigh = 0;

  // Axe layer: distinct blade texture that tumbles (rotation is dynamic). Axes
  // live in the same projectile SoA as daggers; we route by kind into this pool.
  private axeContainer!: ParticleContainer;
  private axeParticles: Particle[] = [];
  private axeHigh = 0;

  // Piercing Light layer: glowing streak particles, routed by kind from the same
  // projectile SoA, rotated to travel direction (additive blend for a light look).
  private lightContainer!: ParticleContainer;
  private lightParticles: Particle[] = [];
  private lightHigh = 0;

  // XP gem layer: pooled particles, position-only dynamic, one shared gem texture.
  private gemContainer!: ParticleContainer;
  private gemParticles: Particle[] = [];
  private gemHigh = 0;

  // Level-up ring: one Graphics drawn once, expanded + faded over the flash.
  private levelUpRing = new Graphics();

  // Boss: a big scaled sprite, tinted crimson and flashed toward white on hit.
  private bossSprite = new Sprite();

  // Ultimate: a wide blue beam (one Graphics, drawn once pointing +x) and a charge
  // ring that tightens/brightens around the player as Space is held.
  private ultBeam = new Graphics();
  private ultRing = new Graphics();

  // Laser beams: a pool of identical Graphics drawn once pointing +x. The base
  // weapon uses one (rotated to the locked heading); the Prism evolution uses the
  // whole fan. Per active blast we place/rotate/fade the live ones, hide the rest.
  private laserBeams: Graphics[] = [];

  // Damage numbers: composed from pooled digit sprites. Digit glyphs are pre-
  // rendered once to textures (white + a red set for crits); each number lays out
  // its digits by integer math and assigns them to sprites. Per frame we only set
  // texture/position/alpha/scale — all plain field writes, so throughput never
  // allocates (the BitmapText.text re-layout it replaces did, badly).
  private dnLayer = new Container();
  private digitSprites: Sprite[] = [];
  private whiteDigits: Texture[] = []; // index 0..9
  private redDigits: Texture[] = []; // crit color, index 0..9
  private digitWidth = 0; // px advance per digit (monospace → uniform)
  private digitHigh = 0; // high-water count of sprites used last frame

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

    // Load the sprite atlas + a standalone floor tile; nearest keeps pixels crisp.
    const base = import.meta.env.BASE_URL;
    const atlas = await Assets.load<Texture>(base + TILEMAP);
    const floorTex = await Assets.load<Texture>(base + FLOOR_TILE);
    atlas.source.scaleMode = "nearest";
    floorTex.source.scaleMode = "nearest";

    // Tiled floor across the whole world. A standalone texture (not an atlas
    // frame) so TilingSprite can't bleed neighbouring tiles at the seams.
    const floor = (this.floor = new TilingSprite({
      texture: floorTex,
      width: WORLD_W,
      height: WORLD_H,
    }));
    floor.tileScale.set(FLOOR_TILE_SCALE);
    floor.tint = FLOOR_TINT; // darken the bright tile into a moody dungeon floor
    // A thin border just frames the play field.
    const border = new Graphics()
      .rect(0, 0, WORLD_W, WORLD_H)
      .stroke({ width: 3, color: 0x0a0c10, alpha: 0.8 });

    // Player sprite.
    this.playerSprite.texture = this.tile(atlas, T_PLAYER);
    this.playerSprite.anchor.set(0.5);
    this.playerSprite.scale.set(PLAYER.radius * SPRITE_PER_RADIUS);

    // Sword: a blade sprite anchored at the hilt (bottom-center) so it pivots from
    // the grip. The render loop points it forward and swings it back and forth while
    // an enemy is in striking range (state.swordActive); hidden otherwise.
    this.swordSprite.texture = this.tile(atlas, T_SWORD);
    this.swordSprite.anchor.set(0.5, 1);
    this.swordSprite.scale.set(PLAYER.radius * SPRITE_PER_RADIUS * 1.3);
    this.swordSprite.visible = false;

    // One batched particle pool per enemy type (each its own sprite). Scale is
    // dynamic (vertex) so each enemy sizes to its radius and punches on hit.
    for (let t = 0; t < T_ENEMY.length; t++) {
      const pool = this.buildParticlePool(
        this.tile(atlas, T_ENEMY[t]!),
        0xffffff,
        ENEMY.capacity,
        { position: true, vertex: true },
      );
      this.enemyPools.push({ ...pool, high: 0 });
      this.enemyCursors.push(0);
    }

    // Dagger projectiles: sprite that rotates to face travel (rotation dynamic).
    const proj = this.buildParticlePool(
      this.tile(atlas, T_DAGGER),
      0xffffff,
      PROJECTILE_CAPACITY,
      { position: true, rotation: true },
      (DAGGER.projectileRadius * 4) / TILE,
    );
    this.projContainer = proj.container;
    this.projParticles = proj.particles;

    // Axe: sprite that tumbles (rotation dynamic) and sizes to its own radius
    // (vertex) so Cyclone's 2× axes render bigger than the base lob.
    const axe = this.buildParticlePool(
      this.tile(atlas, T_AXE),
      0xffffff,
      PROJECTILE_CAPACITY,
      { position: true, rotation: true, vertex: true },
      AXE.radius * SPRITE_PER_RADIUS,
    );
    this.axeContainer = axe.container;
    this.axeParticles = axe.particles;

    // Piercing Light: a glowing horizontal streak, rotated to travel direction and
    // sized (vertex) to the ray's hitbox thickness. Additive blend reads as light.
    const lightTex: Texture = this.app.renderer.generateTexture(
      new Graphics().roundRect(-32, -4, 64, 8, 4).fill(0xffffff),
    );
    const light = this.buildParticlePool(
      lightTex,
      0x9fd8ff, // pale blue; additive over the dark floor reads white-hot at the core
      PROJECTILE_CAPACITY,
      { position: true, rotation: true, vertex: true },
    );
    this.lightContainer = light.container;
    this.lightContainer.blendMode = "add";
    this.lightParticles = light.particles;

    // XP gems: small bright diamonds-as-circles, one shared texture, tinted cyan.
    const gemTex: Texture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, XP.gemRadius).fill(0xffffff),
    );
    const gem = this.buildParticlePool(gemTex, 0x5cf2ff, XP.capacity);
    this.gemContainer = gem.container;
    this.gemParticles = gem.particles;

    // Level-up ring (gold), drawn once at origin; placed/scaled/faded per frame.
    this.levelUpRing
      .circle(0, 0, 40)
      .stroke({ width: 4, color: 0xffd86b, alpha: 0.9 });
    this.levelUpRing.visible = false;

    // Boss sprite: scaled big, tinted crimson; flashes toward white on hit.
    this.bossSprite.texture = this.tile(atlas, T_BOSS);
    this.bossSprite.anchor.set(0.5);
    this.bossSprite.scale.set(BOSS.radius * SPRITE_PER_RADIUS);
    this.bossSprite.tint = BOSS.color;
    this.bossSprite.visible = false;

    // Laser beam, drawn once at the canonical aim (origin at the player, pointing +x,
    // length = range). Per active blast we just place + rotate + fade it — no geometry
    // rebuild. Layered glow → hot core gives it body; a muzzle flare anchors it at the
    // player; additive blend makes it read as light over the dark floor.
    {
      const half = LASER.width / 2;
      // One beam Graphics per possible Prism segment; the base weapon only ever
      // shows the first (full length). Per segment we scale x to its length.
      for (let i = 0; i < MAX_LASER_SEGMENTS; i++) {
        const beam = new Graphics();
        beam
          .rect(0, -half * 1.8, LASER.range, half * 3.6)
          .fill({ color: 0xff2a2a, alpha: 0.16 }) // soft outer glow
          .rect(0, -half, LASER.range, half * 2)
          .fill({ color: 0xff5a3c, alpha: 0.5 }) // mid body
          .rect(0, -half * 0.5, LASER.range, half)
          .fill({ color: 0xffe8b0, alpha: 0.95 }) // hot core
          .circle(0, 0, half * 1.6)
          .fill({ color: 0xffffff, alpha: 0.7 }); // muzzle flare
        beam.blendMode = "add";
        beam.visible = false;
        this.laserBeams.push(beam);
      }
    }

    // Ultimate beam: the same layered glow→core build as the laser, but much wider and
    // blue. Drawn once pointing +x at full range; per fire we place + fade it.
    {
      const half = ULTIMATE.width / 2;
      const c = ULTIMATE.color;
      this.ultBeam
        .rect(0, -half * 1.4, ULTIMATE.range, half * 2.8)
        .fill({ color: c.glow, alpha: 0.16 }) // soft outer glow
        .rect(0, -half, ULTIMATE.range, half * 2)
        .fill({ color: c.body, alpha: 0.45 }) // mid body
        .rect(0, -half * 0.45, ULTIMATE.range, half * 0.9)
        .fill({ color: c.core, alpha: 0.95 }) // white-blue core
        .circle(0, 0, half * 1.4)
        .fill({ color: 0xffffff, alpha: 0.7 }); // muzzle flare
      this.ultBeam.blendMode = "add";
      this.ultBeam.visible = false;
    }

    // Ultimate charge ring: drawn once at a base radius; per frame we scale it inward
    // and brighten it as the charge fills (a "closing in" telegraph).
    this.ultRing
      .circle(0, 0, 60)
      .stroke({ width: 5, color: 0x7fb8ff, alpha: 0.9 });
    this.ultRing.blendMode = "add";
    this.ultRing.visible = false;

    // Pre-render each digit 0-9 to a texture, once, in white and in crit-red.
    // Damage numbers are then composed from these — no per-number text layout.
    for (let d = 0; d < 10; d++) {
      const mk = (fill: number): Texture => {
        const t = new Text({
          text: "" + d,
          style: { fontFamily: "monospace", fontSize: 30, fontWeight: "bold", fill },
        });
        const tex = this.app.renderer.generateTexture(t);
        t.destroy();
        return tex;
      };
      this.whiteDigits.push(mk(0xffffff));
      this.redDigits.push(mk(DN_CRIT_COLOR));
    }
    // Monospace → every digit the same width; use it as the layout advance.
    this.digitWidth = this.whiteDigits[0]!.width;

    // Pool of digit sprites: capacity numbers × max digits each.
    for (let i = 0; i < DAMAGE_NUMBER_CAPACITY * DN_MAX_DIGITS; i++) {
      const s = new Sprite(this.whiteDigits[0]!);
      s.anchor.set(0.5);
      s.visible = false;
      this.digitSprites.push(s);
      this.dnLayer.addChild(s);
    }

    // Draw order: backdrop, swarm, projectiles + light streaks, numbers, then gems
    // near the top so the swarm + damage-number text don't bury them, the sword and
    // player above that, and the level-up ring on top.
    this.world.addChild(floor);
    for (const pool of this.enemyPools) this.world.addChild(pool.container);
    this.world.addChild(
      this.bossSprite,
      this.projContainer,
      this.axeContainer,
      this.lightContainer,
      ...this.laserBeams,
      this.ultBeam,
      this.dnLayer,
      this.gemContainer,
      this.swordSprite,
      this.playerSprite,
      border,
      this.levelUpRing,
      this.ultRing,
    );
    this.app.stage.addChild(this.world);

    // Pixi's own ticker drives nothing — our fixed-timestep Loop owns timing.
    this.app.ticker.stop();

    this.layout();
    window.addEventListener("resize", this.layout);
  }

  /** Scale-to-fit the world into the canvas, centered, with letterbox bars. */
  private layout = (): void => {
    // Use the renderer's *logical* screen size (CSS pixels). The scene graph works
    // in logical coordinates — resolution (devicePixelRatio) is applied later at the
    // GPU projection — so we must NOT divide by dpr here. The old `renderer.width /
    // devicePixelRatio` double-counted resolution (renderer.width is already logical)
    // and shrank the whole world to 1/dpr on HiDPI/Retina displays, leaving it pinned
    // in the upper-left at half size.
    const { width: sw, height: sh } = this.app.renderer.screen;
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
    this.playerSprite.position.set(p.pos.x, p.pos.y);
    // Blink while invulnerable (i-frames) so a hit reads instantly; solid otherwise.
    this.playerSprite.alpha =
      p.invuln > 0 && ((p.invuln * 20) | 0) % 2 === 0 ? 0.35 : 1;
    // God mode tints the player gold; gated so the tint setter runs only on change.
    if (state.godMode !== this.shownGod) {
      this.playerSprite.tint = state.godMode ? 0xffd700 : 0xffffff;
      this.shownGod = state.godMode;
    }

    // Scroll the floor left so the player reads as advancing rightward through the
    // world (the side-scroller illusion). Keyed off sim-time → smooth and seek-safe.
    this.floor.tilePosition.x = -state.time * FLOOR_SCROLL_SPEED;

    // Sword: each swing sweeps the blade once across its arc over the weapon's
    // cooldown, alternating direction (a real back-and-forth). The blade is anchored
    // at the hilt and points forward (+x) at rest. It stays visible while a mob is in
    // range OR while a sweep is still finishing — so a one-shot kill still shows a
    // full, consistent swing instead of a single-frame flash.
    {
      const w = state.weapons.whip;
      const cd =
        (w.evolved ? WHIP.evo.cooldown : w.cooldown) / state.passives.fireRateMult;
      const elapsed = state.time - state.swordSwingStart;
      const swinging = elapsed < cd;
      this.swordSprite.visible = state.swordActive || swinging;
      if (this.swordSprite.visible) {
        this.swordSprite.position.set(p.pos.x, p.pos.y);
        const rest = Math.PI / 2; // hilt-anchored blade points +x (right) at rest
        const t = swinging ? elapsed / cd : 1;
        const eased = t * t * (3 - 2 * t); // smoothstep — accelerate then settle
        const from = state.swordSwingDir ? -WHIP.swingArc : WHIP.swingArc;
        const to = state.swordSwingDir ? WHIP.swingArc : -WHIP.swingArc;
        this.swordSprite.rotation = rest + from + (to - from) * eased;
      }
    }

    this.syncEnemies(state.enemies);

    this.syncProjectiles(state.projectiles);

    // Laser: while a blast is active, place/rotate/fade the live beam(s). The base
    // weapon shows one full-length beam along the locked heading; Prism draws its
    // segment tree (each scaled in x to its own length).
    if (state.laserActive > 0) {
      const dur = state.weapons.laser.evolved ? LASER.evo.duration : LASER.duration;
      const f = state.laserActive / dur; // 1 → 0 over the blast
      const alpha = f < 0.3 ? f / 0.3 : 1; // hold, then fade the final 30%
      const beams = this.laserBeams;
      let shown = 0;
      if (state.weapons.laser.evolved) {
        const segs = state.laserSegments;
        shown = segs.count;
        for (let k = 0; k < shown; k++) {
          const beam = beams[k]!;
          beam.position.set(segs.ox[k]!, segs.oy[k]!);
          beam.rotation = segs.angle[k]!;
          // x → segment length; y → its (shrinking) thickness.
          beam.scale.set(segs.len[k]! / LASER.range, segs.width[k]!);
          beam.alpha = alpha;
          beam.visible = true;
        }
      } else {
        const beam = beams[0]!;
        beam.position.set(p.pos.x, p.pos.y);
        beam.rotation = Math.atan2(state.laserDirY, state.laserDirX);
        beam.scale.set(1, 1);
        beam.alpha = alpha;
        beam.visible = true;
        shown = 1;
      }
      for (let k = shown; k < beams.length; k++) {
        if (beams[k]!.visible) beams[k]!.visible = false;
      }
    } else {
      for (const beam of this.laserBeams) if (beam.visible) beam.visible = false;
    }

    // Ultimate beam: while firing, place it forward (+x) and fade the final 30%.
    if (state.ultActive > 0) {
      const f = state.ultActive / ULTIMATE.duration; // 1 → 0 over the blast
      this.ultBeam.position.set(p.pos.x, p.pos.y);
      this.ultBeam.rotation = 0; // forward — facing is locked right
      this.ultBeam.alpha = f < 0.3 ? f / 0.3 : 1; // hold, then fade out
      this.ultBeam.visible = true;
    } else if (this.ultBeam.visible) {
      this.ultBeam.visible = false;
    }

    // Ultimate charge ring: tighten + brighten as the charge fills (a slight pulse).
    if (state.ultCharge > 0) {
      const frac = Math.min(1, state.ultCharge / ULTIMATE.chargeTime);
      this.ultRing.position.set(p.pos.x, p.pos.y);
      this.ultRing.scale.set(2.6 - 1.6 * frac + 0.05 * Math.sin(state.time * 30));
      this.ultRing.alpha = 0.25 + 0.65 * frac;
      this.ultRing.visible = true;
    } else if (this.ultRing.visible) {
      this.ultRing.visible = false;
    }

    // XP gems: pooled particles, position-only.
    const gm = state.gems;
    const gp = this.gemParticles;
    const gn = gm.count;
    for (let i = 0; i < gn; i++) {
      const p2 = gp[i]!;
      p2.x = gm.posX[i]!;
      p2.y = gm.posY[i]!;
    }
    for (let i = gn; i < this.gemHigh; i++) {
      const p2 = gp[i]!;
      p2.x = OFFSCREEN;
      p2.y = OFFSCREEN;
    }
    this.gemHigh = gn;

    // Boss: place it, and flash its tint toward white on hit.
    const boss = state.boss;
    if (boss.active) {
      this.bossSprite.visible = true;
      this.bossSprite.position.set(boss.pos.x, boss.pos.y);
      const ht = boss.hitTimer;
      if (ht > 0) {
        const t = ht / ENEMY.hitReactTime; // 1 at impact → 0
        const c = BOSS.color;
        const r = (c >> 16) & 0xff;
        const g = (c >> 8) & 0xff;
        const bl = c & 0xff;
        this.bossSprite.tint =
          (((r + (255 - r) * t) | 0) << 16) |
          (((g + (255 - g) * t) | 0) << 8) |
          ((bl + (255 - bl) * t) | 0);
      } else {
        this.bossSprite.tint = BOSS.color;
      }
    } else if (this.bossSprite.visible) {
      this.bossSprite.visible = false;
    }

    // Level-up ring: expand outward and fade over the flash.
    if (state.levelUpTimer > 0) {
      const t = state.levelUpTimer / LEVEL.upFlashTime; // 1 → 0
      this.levelUpRing.position.set(p.pos.x, p.pos.y);
      this.levelUpRing.scale.set(1 + (1 - t) * 2.2);
      this.levelUpRing.alpha = t;
      this.levelUpRing.visible = true;
    } else if (this.levelUpRing.visible) {
      this.levelUpRing.visible = false;
    }

    this.syncDamageNumbers(state.damageNumbers);

    this.app.renderer.render(this.app.stage);
  }

  /** A 16px tile from the atlas (12-column, gapless), as its own Texture frame. */
  private tile(atlas: Texture, idx: number): Texture {
    const c = idx % ATLAS_COLS;
    const r = (idx / ATLAS_COLS) | 0;
    return new Texture({
      source: atlas.source,
      frame: new Rectangle(c * TILE, r * TILE, TILE, TILE),
    });
  }

  /**
   * Build a pooled ParticleContainer: capacity particles parked off-screen, all
   * sharing one texture. `dynamic` picks which per-particle buffers re-upload
   * each frame; `scale` bakes a static size (ignored when vertex is dynamic).
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
    scale = 1,
  ): { container: ParticleContainer; particles: Particle[] } {
    const particles: Particle[] = [];
    for (let i = 0; i < capacity; i++) {
      particles.push(
        new Particle({
          texture: tex,
          tint,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: scale,
          scaleY: scale,
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
   * Sync the swarm: route each enemy into its type's pool, set position and a
   * scale = radius × sprite factor × the hit-react punch. Parks each pool's
   * leftovers off-screen.
   */
  private syncEnemies(e: Enemies): void {
    const pools = this.enemyPools;
    const count = e.count;
    const posX = e.posX;
    const posY = e.posY;
    const hitTimer = e.hitTimer;
    const radius = e.radius;
    const type = e.type;
    const reactInv = 1 / ENEMY.hitReactTime;
    const wobble = ENEMY.hitWobble;
    const cursors = this.enemyCursors;
    cursors.fill(0);

    for (let i = 0; i < count; i++) {
      const pool = pools[type[i]!]!;
      const p = pool.particles[cursors[type[i]!]!++]!;
      p.x = posX[i]!;
      p.y = posY[i]!;
      const sizeScale = radius[i]! * SPRITE_PER_RADIUS;
      const ht = hitTimer[i]!;
      const s = ht > 0 ? sizeScale * (1 + wobble * ht * reactInv) : sizeScale;
      p.scaleX = s;
      p.scaleY = s;
    }

    for (let t = 0; t < pools.length; t++) {
      const pool = pools[t]!;
      const n = cursors[t]!;
      for (let i = n; i < pool.high; i++) {
        const p = pool.particles[i]!;
        p.x = OFFSCREEN;
        p.y = OFFSCREEN;
      }
      pool.high = n;
    }
  }

  /**
   * Route the mixed projectile SoA into its two visual pools by kind: daggers to
   * the projectile pool, axes to the spinning blade pool (with rotation). Parks
   * each pool's leftovers off-screen.
   */
  private syncProjectiles(pr: Projectiles): void {
    const daggerP = this.projParticles;
    const axeP = this.axeParticles;
    const lightP = this.lightParticles;
    const posX = pr.posX;
    const posY = pr.posY;
    const velX = pr.velX;
    const velY = pr.velY;
    const spin = pr.spin;
    const radius = pr.radius;
    const kind = pr.kind;
    const n = pr.count;
    let dN = 0;
    let aN = 0;
    let lN = 0;
    for (let i = 0; i < n; i++) {
      if (kind[i] === PROJ_AXE) {
        const p = axeP[aN++]!;
        p.x = posX[i]!;
        p.y = posY[i]!;
        p.rotation = spin[i]!; // tumble
        const s = radius[i]! * SPRITE_PER_RADIUS; // size to this axe's radius
        p.scaleX = s;
        p.scaleY = s;
      } else if (kind[i] === PROJ_LIGHT) {
        const p = lightP[lN++]!;
        p.x = posX[i]!;
        p.y = posY[i]!;
        p.rotation = Math.atan2(velY[i]!, velX[i]!); // streak points along travel
        // The 64×8 streak texture: stretch it long and thin — a sliver of light.
        // Thickness tracks the ray's hitbox radius (Reek/AoE visibly fatten it).
        p.scaleX = 3.0; // ~190px streak
        p.scaleY = radius[i]! / 22; // skinny (~5px at base)
      } else {
        const p = daggerP[dN++]!;
        p.x = posX[i]!;
        p.y = posY[i]!;
        p.rotation = Math.atan2(velY[i]!, velX[i]!) + DAGGER_SPRITE_OFFSET;
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
    for (let i = lN; i < this.lightHigh; i++) {
      const p = lightP[i]!;
      p.x = OFFSCREEN;
      p.y = OFFSCREEN;
    }
    this.projHigh = dN;
    this.axeHigh = aN;
    this.lightHigh = lN;
  }

  /**
   * Compose each active damage number from pooled digit sprites: extract digits
   * by integer math, lay them out centered on the number, and set
   * texture/position/alpha/scale. White sprites for normal hits, the red set
   * (bigger) for crits. All plain field writes — zero allocation per number, so
   * throughput is free (the whole point of replacing BitmapText).
   */
  private syncDamageNumbers(dn: DamageNumbers): void {
    const sprites = this.digitSprites;
    const white = this.whiteDigits;
    const red = this.redDigits;
    const w = this.digitWidth;
    const cap = sprites.length;
    const n = dn.count;
    let s = 0; // sprite cursor across all numbers

    for (let i = 0; i < n && s < cap; i++) {
      const v = dn.value[i]!;
      const crit = dn.crit[i]! === 1;
      const alpha = 1 - dn.age[i]! / DN_TTL;
      const scale = crit ? DN_CRIT_SCALE : 1;
      const set = crit ? red : white;

      // Digits, least-significant first.
      let nd = 0;
      let t = v;
      do {
        digitScratch[nd++] = t % 10;
        t = (t / 10) | 0;
      } while (t > 0 && nd < DN_MAX_DIGITS);

      // Lay out left→right, centered on the number's position.
      const advance = w * scale;
      const startX = dn.posX[i]! - ((nd - 1) * advance) / 2;
      const y = dn.posY[i]!;
      for (let p = 0; p < nd && s < cap; p++) {
        const sp = sprites[s++]!;
        sp.texture = set[digitScratch[nd - 1 - p]!]!;
        sp.x = startX + p * advance;
        sp.y = y;
        sp.alpha = alpha;
        sp.scale.set(scale);
        sp.visible = true;
      }
    }

    for (let i = s; i < this.digitHigh; i++) sprites[i]!.visible = false;
    this.digitHigh = s;
  }
}
