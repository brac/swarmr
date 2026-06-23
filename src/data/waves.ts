// Spawn / wave config. For the slice this just ramps to the entity-count target
// so we can validate the swarm holds frame budget (docs/01 checkpoint 7).

export const SPAWN = {
  targetCount: 2000, // the north-star entity count
  perTick: 4, // enemies spawned per logic tick until target (240Hz → ~2s ramp)
} as const;
