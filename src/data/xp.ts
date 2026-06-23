// XP gems + leveling tunables. Enemies drop one gem on death; gems home toward
// the player when close and grant XP on pickup; enough XP levels you up.

export const XP = {
  gemValue: 1, // XP granted per gem
  gemRadius: 11, // gem visual radius (px)
  pickupRadius: 34, // collected when the player is this close (px)
  magnetRadius: 105, // gems within this range home in; smaller → gems pile up first
  magnetSpeed: 640, // homing speed (px/s)
  capacity: 2048, // pooled gem ceiling
} as const;

export const LEVEL = {
  baseXp: 5, // XP needed to go from level 1 → 2
  growth: 1.2, // each level needs growth× the previous requirement
  upHeal: 0.25, // fraction of max HP restored on level up
  upFlashTime: 0.5, // level-up ring/flash duration (s)
} as const;

// XP required to advance FROM `level` to the next. A gently rising curve.
export function xpToNext(level: number): number {
  return Math.ceil(LEVEL.baseXp * Math.pow(LEVEL.growth, level - 1));
}
