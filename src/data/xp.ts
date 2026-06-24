// Gem tunables. Gems are now SPARSE and VALUABLE: ~`runTotal` drop across the
// whole ramp (not one per kill), and each one collected grants a single upgrade.
// They lie on the "ground" and drift left with the world (side-scroller), homing
// to the player only once in magnet range.

export const XP = {
  runTotal: 50, // total gems dropped over the ~9-min ramp (sparse on purpose)
  gemRadius: 15, // gem visual radius (px) — bigger now that they're rare
  pickupRadius: 34, // collected when the player is this close (px)
  magnetRadius: 130, // gems within this range home in (a touch wider — they're precious)
  magnetSpeed: 640, // homing speed (px/s)
  driftSpeed: 45, // left drift (px/s) — slower than every mob so the swarm overtakes the gems
  capacity: 2048, // pooled gem ceiling
} as const;

export const LEVEL = {
  upFlashTime: 0.5, // level-up ring/flash duration (s)
} as const;
