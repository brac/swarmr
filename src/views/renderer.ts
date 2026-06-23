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
import { WORLD_W, WORLD_H } from "../state/gameState";
import { ENEMY } from "../data/enemies";
import { PLAYER } from "../data/player";
import { DAGGER, WHIP, GARLIC, AXE } from "../data/weapons";
import { XP, LEVEL } from "../data/xp";
import { BOSS } from "../data/boss";
import type { Enemies } from "../state/enemies";
import type { Projectiles } from "../state/projectiles";
import { PROJECTILE_CAPACITY, PROJ_AXE } from "../state/projectiles";
import type { DamageNumbers } from "../state/damageNumbers";
import { DAMAGE_NUMBER_CAPACITY, DN_TTL } from "../state/damageNumbers";
import { WHIP_STRIKE_CAPACITY } from "../state/whipStrikes";

// Where inactive pooled particles sit — well outside the 1920x1080 world so they
// never draw. Position is dynamic, so parking here is a cheap per-frame write.
const OFFSCREEN = -10000;

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
const T_ENEMY = [108, 122, 109]; // grunt=slime, runner=spider, tank=orc
const T_BOSS = 121; // skull-wraith
const T_DAGGER = 103;
const T_AXE = 118;

// A 16px sprite covers ~3.2× the entity radius (overhang beyond the hitbox reads
// better — characters look chunkier than their collision circle).
const SPRITE_PER_RADIUS = 3.2 / TILE;
// The dagger art points up; rotate it from that to its travel direction.
const DAGGER_SPRITE_OFFSET = Math.PI / 2;
const FLOOR_TILE_SCALE = 3; // 16px floor tile → 48px on the world grid
const FLOOR_TINT = 0x363c47; // dark slate; multiplies the bright floor tile down

export class Renderer {
  readonly app = new Application();
  /** Everything in world space lives under here; we scale/position it to fit. */
  private world = new Container();
  private playerSprite = new Sprite();
  private garlicAura = new Graphics(); // persistent damage aura around the player
  private shownGod = false; // last-applied god-mode tint state (gate the tint write)

  // Swarm: one batched ParticleContainer per enemy type (each its own sprite
  // texture), routed by type in syncEnemies. Position + scale (vertex) are
  // dynamic so each enemy sizes to its radius and scale-punches on hit.
  private enemyPools: {
    container: ParticleContainer;
    particles: Particle[];
    high: number;
  }[] = [];

  // Projectile (Dagger) layer: same pooled-particle pattern, its own texture/tint.
  private projContainer!: ParticleContainer;
  private projParticles: Particle[] = [];
  private projHigh = 0;

  // Axe layer: distinct blade texture that tumbles (rotation is dynamic). Axes
  // live in the same projectile SoA as daggers; we route by kind into this pool.
  private axeContainer!: ParticleContainer;
  private axeParticles: Particle[] = [];
  private axeHigh = 0;

  // XP gem layer: pooled particles, position-only dynamic, one shared gem texture.
  private gemContainer!: ParticleContainer;
  private gemParticles: Particle[] = [];
  private gemHigh = 0;

  // Level-up ring: one Graphics drawn once, expanded + faded over the flash.
  private levelUpRing = new Graphics();

  // Boss: a big scaled sprite, tinted crimson and flashed toward white on hit.
  private bossSprite = new Sprite();

  // Whip strikes: a small pool of wedge Graphics, each drawn once at the canonical
  // aim (pointing +x). Per active strike we set position/rotation/alpha — no
  // per-frame geometry rebuild. Inactive ones are hidden.
  private whipLayer = new Container();
  private whipGraphics: Graphics[] = [];
  private whipHigh = 0;

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
    const floor = new TilingSprite({
      texture: floorTex,
      width: WORLD_W,
      height: WORLD_H,
    });
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

    // Garlic aura: a faint greenish disc with a soft ring, drawn once at origin
    // and moved to the player each frame. Alpha pulses gently for an "aura" feel.
    this.garlicAura
      .circle(0, 0, GARLIC.radius)
      .fill({ color: 0x88ff88, alpha: 0.06 })
      .circle(0, 0, GARLIC.radius)
      .stroke({ width: 2, color: 0x88ff88, alpha: 0.25 });

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

    // Axe: sprite that tumbles (rotation dynamic).
    const axe = this.buildParticlePool(
      this.tile(atlas, T_AXE),
      0xffffff,
      PROJECTILE_CAPACITY,
      { position: true, rotation: true },
      AXE.radius * SPRITE_PER_RADIUS,
    );
    this.axeContainer = axe.container;
    this.axeParticles = axe.particles;

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

    // Draw order: backdrop, garlic aura, swarm, whip arcs, projectiles, numbers,
    // then gems near the top so the swarm + damage-number text don't bury them,
    // player, and the level-up ring on top. The aura sits under the swarm.
    this.world.addChild(floor, this.garlicAura);
    for (const pool of this.enemyPools) this.world.addChild(pool.container);
    this.world.addChild(
      this.bossSprite,
      this.whipLayer,
      this.projContainer,
      this.axeContainer,
      this.dnLayer,
      this.gemContainer,
      this.playerSprite,
      border,
      this.levelUpRing,
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
    this.playerSprite.position.set(p.pos.x, p.pos.y);
    // Blink while invulnerable (i-frames) so a hit reads instantly; solid otherwise.
    this.playerSprite.alpha =
      p.invuln > 0 && ((p.invuln * 20) | 0) % 2 === 0 ? 0.35 : 1;
    // God mode tints the player gold; gated so the tint setter runs only on change.
    if (state.godMode !== this.shownGod) {
      this.playerSprite.tint = state.godMode ? 0xffd700 : 0xffffff;
      this.shownGod = state.godMode;
    }

    // Garlic aura follows the player; scales with the (upgradeable) radius and
    // pulses its alpha to read as "active".
    this.garlicAura.position.set(p.pos.x, p.pos.y);
    this.garlicAura.scale.set(state.weapons.garlic.radius / GARLIC.radius);
    this.garlicAura.alpha = 0.75 + 0.25 * Math.sin(state.time * 4);

    this.syncEnemies(state.enemies);

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
    const cursors = [0, 0, 0];

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
    const posX = pr.posX;
    const posY = pr.posY;
    const velX = pr.velX;
    const velY = pr.velY;
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
        p.rotation = spin[i]!; // tumble
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
    this.projHigh = dN;
    this.axeHigh = aN;
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
