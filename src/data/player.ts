// Player tunables. Centralized here so systems carry no magic numbers (the
// project rule: code reads data/, designers edit data/).

export const PLAYER = {
  speed: 300, // px/sec
  radius: 16, // collision radius (px) — also the contact-damage hit radius
  maxHp: 5, // health is a 5-HEART tracker: each hit costs one heart, 0 = game over
  invulnTime: 0.6, // i-frames after taking a hit (s): one hit per window, not melted
} as const;
