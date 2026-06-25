# Swarmr Backlog

## Ultimate ✅ (implemented — ungated)
The player has a new ability, ultimate. It will be gated behind some mechnaic but for now let's try it out
player presses and holds space bar. After a 4 second charge up a huge beam of magic shoots forward to the right, similar to how the laser works now but much wider and blue. It will destroy any mob it touches except the boss
> Built: hold Space → 4s charge (a tightening blue ring telegraphs it) → a wide blue beam fires `+x` for `ULTIMATE.duration` and instakills every mob in the band (boss immune). Releasing Space or taking a hit cancels the charge; re-charge requires releasing after a fire. Ungated for now — see "Ultimate trigger" for the combo unlock. Tunables in `data/ultimate.ts`.

## Ultimate trigger
The player needs to work to unlock their ultimate. For this is is a matter of getting the right combos between
passive power ups and weapons. 1 passive and 1 weapon will give you the big beam. 2 passive and 1 weapon will give you another, 1 passive and 2 weapons will give you another. Give me a list of all the passive sand weapons and how many combinations we are looking at. it will proabhly be too much and we will have to edit

## Mob behavior variation ✅ (implemented)
Mobs should move differently. Come in as a group of 20 of the same mob, run fast and staright for the player. A wall of a bunch of high HP mobs appear in front of the player and they move towards them making the circle smaler.
> Built: new `MOVE_*` modes — `MOVE_SINE` (a fraction of the ambient stream weaves on a sine wave) and `MOVE_WALL` (advance + slide toward the player's row). Plus a formation spawner (`updateFormations`, `systems/spawn.ts`) firing on a sim-time cadence: a **rush** pack (20 fast Runners homing as a group, from 1:15) and a **wall** (a vertical line of slow high-HP Carapaces that closes in, from 2:45). Tunables: `MOVE_TUNING` (`data/enemies.ts`) + `FORMATIONS` (`data/waves.ts`).

## New Garlic ✅ (implemented)
Garlic is now Piercing light. A single ray of white blue white light fires from the player at an angle to the top or bottom. About 45 degrees either up or down. When the ray of light, which moves about twice as fast as an axe, bounces off the top or bottom that it hits and reflects back the opisite direction. It does this for a maxmium of 5 reflections or until it proceesds off the map.
> Built: the ray aims toward the nearest enemy (snapped to ±45°), rides the projectile pool (`PROJ_LIGHT`, infinite pierce), reflects off top/bottom up to 5× (8× evolved "Refraction", which also fires up+down). Tunables in `data/weapons.ts` `GARLIC`.

## New Whip ✅ (implemented)
It's now a sword that activates when the player is within striking range of a mob. Use on the sword spirtes
animate it so it swings back and forth quickly.
> Built: a blade sprite (tile 104) that appears + swings (sin oscillation) only when a mob is within `range`, cleaving everything in a forward arc. Evolution "Flurry" = ~2× faster + bigger reach. Tunables in `data/weapons.ts` `WHIP`. Sprite tile/scale worth tuning in-game.

## Floor
We need some textuire on the fllor to convey movement. Use some tile varition lighty on the floor texture so we can see some movement