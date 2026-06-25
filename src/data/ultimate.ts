// Ultimate tunables. The player holds Space to charge, then fires a huge wide blue
// beam forward that destroys every mob it touches (not the boss). Ungated for now —
// the combo-unlock ("Ultimate trigger") is a later backlog item. Systems read these.
export const ULTIMATE = {
  chargeTime: 4.0, // seconds of holding Space before it fires
  duration: 0.6, // seconds the beam stays ON after firing (kills each tick it's on)
  range: 2500, // beam length (px) — overshoots the world so it always runs off-screen
  width: 280, // full beam thickness (px); half is the hit test's perpendicular limit
  // Blue glow → white-blue core (mirrors the laser's layered build, recolored).
  color: { glow: 0x2a5cff, body: 0x4d9bff, core: 0xdcecff },
} as const;
