// Weapon tunables. Systems read these numbers and hardcode nothing.
// See docs/02-dagger.md.

export const DAGGER = {
  cooldown: 0.5, // seconds between fires
  damage: 10,
  projectileSpeed: 800, // px/sec
  projectileLifetime: 1.5, // seconds
  projectileRadius: 6,
  pierce: 1, // enemies one projectile passes through before despawning
  count: 1, // projectiles per fire (level-up territory later)
} as const;
