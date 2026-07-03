# MC Slow TV Rail

An infinite, relaxing, cinematic minecart ride through Minecraft's procedurally
generated landscapes — inspired by "Slow TV" train journey videos. You sit in a
perpetually moving minecart on an endless powered-rail line heading due east,
gliding over plains, bridging ravines and oceans, and tunneling through
mountains, forever.

**100% vanilla.** This is a single data pack — no mods, no plugins, no resource
packs.

## Requirements

- Minecraft: Java Edition **1.21 / 1.21.1** (`pack_format` 48)
- Cheats enabled (you need to run one command to start the ride)

## Installation

1. Create a new world (any seed; cheats ON). A fresh world is strongly
   recommended since the ride permanently modifies terrain along its path.
2. Copy the `infinite_rail` folder into the world's `datapacks` folder, or add
   it via the **Data Packs** screen during world creation.
3. Enter the world and run:

   ```
   /function infinite_rail:start
   ```

That's it. You are placed in a minecart at your current location and the ride
begins, heading east. Press **F1** for the full ambient experience.

To end the ride:

```
/function infinite_rail:stop
```

(This stops the builder and removes the cart; run `/gamemode creative` if you
want to move around afterward.)

## What it does

- **Perpetual motion** — the track is built exclusively from always-powered
  rails. Each rail sits on a smooth stone block with a redstone torch buried
  beneath it (`stone / torch / stone / rail`), so every single rail is
  permanently powered. Two per-tick keepers guarantee the ride never ends: if
  the cart ever stalls (mob collision, freak accident) it is re-boosted, and if
  the rider ever dismounts they are put straight back in the cart.
- **Terrain smoothing** — an invisible track head runs up to ~112 blocks ahead
  of the cart. For every column it samples the vanilla terrain heightmap at 12
  points across the next 48 blocks, maintains a rolling average, and steers the
  rail toward *average terrain + 4 blocks*, changing elevation at most 1 block
  every 3 (a gentle ~18° max grade). Approaching mountains raise the average
  early, so climbs start well in advance and ascend in one smooth swoop.
- **Bridges** — every rail carries its own 3-block support column, so whenever
  the ground drops away (ravines, valleys, oceans, lava lakes) the line simply
  becomes a slender floating bridge at cruising altitude. Sudden narrow dips
  are deliberately ignored by the smoother (each sample can only pull the
  average down 2 blocks per column) and get bridged dead level.
- **Tunnels** — every column also carves a 3-wide clearance bore above the
  rail. When a mountain is too steep to climb within the slope limit, the line
  naturally continues straight into the rock as a clean tunnel until it breaks
  out the other side. An invisible vanilla light block is embedded above the
  rail in every column, so tunnels are gently lit and nothing can spawn on the
  track.
- **Forced generation ahead, aggressive unloading behind** — the pack
  `forceload`s terrain ~190 blocks ahead of the track head so the scanner
  always has real heightmap data, and removes forceloads a few hundred blocks
  behind. World spawn (with `spawnChunkRadius 0`) and your respawn point roll
  forward with the ride, so nothing stays loaded behind you.
- **Spectator constraints** — you're switched to Adventure mode with max
  Resistance and Saturation, so you can look around freely but can't break the
  track, get hurt, or starve. Mob griefing and fire tick are disabled so the
  scenery can't blow up the line.

## Tuning

Constants live in `data/infinite_rail/function/load.mcfunction` and can also be
changed live in-game, e.g. `/scoreboard players set #HOVER ir 8`:

| Constant     | Default | Meaning                                                        |
| ------------ | ------- | -------------------------------------------------------------- |
| `#HOVER`     | 4       | Cruising altitude above the average terrain surface            |
| `#SPACING`   | 3       | Min. horizontal blocks between 1-block elevation changes       |
| `#AHEAD`     | 112     | How far ahead of the cart the track is kept built              |
| `#MAXTICK`   | 8       | Max track columns built per game tick                          |
| `#UPCLAMP`   | 8       | How hard approaching mountains may pull the target up          |
| `#DOWNCLAMP` | 2       | How hard dips may pull the target down (small = level bridges) |

## Vanilla limitations

- Commands can unload chunks but cannot delete them from disk, so the world
  folder still grows slowly on long rides. Memory usage stays flat — passed
  chunks are fully unloaded.
- The ride is designed for a single viewer (one cart, one rider).
- Start it in the Overworld; the Nether's bedrock ceiling confuses surface
  heightmaps.

## How it's built

Everything runs from `#minecraft:tick`. A `marker` entity is the track head; a
second marker is a probe that gets teleported around with
`execute positioned over motion_blocking_no_leaves` to read the world
heightmap into scoreboards. Column placement, slope decisions (flat /
`ascending_east` / `ascending_west`), chunk management, and the keepers are
all plain scoreboard math in `data/infinite_rail/function/`.
