// Shared combat math tunables — variance and crits apply to every weapon's hit,
// so they live here rather than per-weapon. See systems/combat.ts (rollHit).

export const COMBAT = {
  damageVariance: 0.15, // ±15% spread rolled on every hit, so numbers aren't flat
  critChance: 0.15, // chance a hit crits
  critMultiplier: 2, // crit damage = base × this
} as const;
