# MC Slow TV Rail

An infinite, relaxing, cinematic minecart ride through Minecraft's procedurally
generated landscapes — inspired by "Slow TV" train journey videos. You sit in a
perpetually moving minecart on an endless powered-rail line heading due east,
gliding over plains, bridging ravines and oceans, and tunneling through
mountains, forever.

**100% vanilla.** This is a single data pack — no mods, no plugins, no resource
packs.

## Requirements

- Minecraft: Java Edition **1.21 / 1.21.1** through **26.2**. The manifest
  declares the full span, so the in-game GUI accepts it on all of these without
  the "made for a different version" warning.
- Cheats enabled (you need to run one command to start the ride)

> **Note on version numbers:** these are all *data pack* format numbers, which
> are a **separate series** from *resource pack* format numbers — the same
> release has different numbers for each (for 26.1, data format 101 vs resource
> format 84). Since this is a data pack, only the data numbers apply: 1.21.1 =
> 48, 26.2 = **107**. `pack.mcmeta` declares `pack_format: 48` for old clients
> (1.21/1.21.1) plus `min_format: 82` / `max_format: 107` for the current scheme
> (introduced in 25w31a), which covers everything up to 26.2. To extend support
> to a newer release, just raise `max_format` to that version's data-pack
> number.

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
  rails. Each rail sits directly on a **block of redstone**, which powers it,
  is immune to water, and emits no light — so the power source can never be
  washed away by oceans/rivers or melt the surrounding ice, even skimming low
  over water. The redstone block is disguised as smooth stone by a **block
  display**, so from the side (e.g. on a bridge) it reads as a plain stone
  support. Two per-tick keepers guarantee the ride never ends: if the cart ever
  stalls (mob collision, freak accident) it is re-boosted, and if the rider ever
  dismounts they are put straight back in the cart.
- **Terrain smoothing** — an invisible track head runs up to ~112 blocks ahead
  of the cart. For every column it samples the vanilla terrain heightmap at 12
  points across the next 48 blocks and maintains a rolling average, steering the
  rail toward *average terrain + 4 blocks*. Approaching mountains raise the
  average early, so climbs start well in advance and ascend in one smooth swoop.
- **The "event" model (no stair-stepping)** — the rail is never stepped up one
  block, held flat, then stepped up again. Instead every elevation change is a
  single continuous **45° line** — consecutive ascending rails, corner to
  corner — that runs until it reaches the target height, however many blocks
  that is, and then the rail goes flat. A 12-block rise is one clean diagonal,
  not twelve little steps. Two spacing constants shape how big and how frequent
  these changes are: `#SAMEGAP` (minimum flat distance before sloping *again in
  the same direction*) and `#TURNGAP` (minimum flat distance before *reversing*
  direction). When terrain would demand a change sooner than the gaps allow, the
  rail simply holds its height instead — which is exactly what produces the
  bridges and tunnels below.
- **Bridges** — every rail carries its own 3-block support column, so whenever
  the ground drops away (ravines, valleys, oceans, lava lakes) the line simply
  becomes a slender floating bridge at cruising altitude. Sudden narrow dips
  are deliberately ignored by the smoother (each sample can only pull the
  average down 2 blocks per column) and, if a descent is forbidden by
  `#TURNGAP`/`#SAMEGAP`, the rail holds level and bridges straight across.
- **Tunnels** — every column also carves a 3-wide clearance bore above the
  rail. When a mountain rises faster than the spacing constants allow the rail
  to climb, the line naturally continues straight into the rock as a clean
  tunnel until it breaks out the other side ("punch through instead of going
  over it"). An invisible vanilla light block is embedded above the rail in
  every column, so tunnels are gently lit and nothing can spawn on the track.
- **Forced generation ahead, aggressive unloading behind** — the pack
  `forceload`s terrain `#GENAHEAD` blocks ahead of the track head so the scanner
  always has real heightmap data, and removes forceloads a few hundred blocks
  behind. Note the two independent look-ahead distances: `#AHEAD` is how far
  ahead of the *cart* the rails are laid, and `#GENAHEAD` is how far ahead of
  the *rail head* the world is generated (so terrain exists roughly
  `#AHEAD + #GENAHEAD` blocks ahead of the cart). World spawn (with
  `spawnChunkRadius 0`) and your respawn point roll forward with the ride, so
  nothing stays loaded behind you.
- **Spectator constraints** — you're switched to Adventure mode with max
  Resistance and Saturation, so you can look around freely but can't break the
  track, get hurt, or starve. Mob griefing and fire tick are disabled so the
  scenery can't blow up the line.

## Tuning

Every knob lives in one file: **`data/infinite_rail/function/config.mcfunction`**.
Edit a value there and apply it in either of two ways:

- **Reload or rejoin the world** — the file runs automatically, or
- Run **`/function infinite_rail:config`** in chat to apply instantly, even
  mid-ride.

To experiment with a single value *without* editing the file, set its
scoreboard directly in chat:

```
/scoreboard players set #HOVER ir 8
```

Live scoreboard edits take effect on the very next track column (change
`#HOVER` mid-ride and the rail smoothly migrates to the new altitude). They're
temporary — a reload or rejoin resets everything to the values in
`config.mcfunction`, which are therefore your permanent defaults.

| Constant     | Default | Meaning                                                             |
| ------------ | ------- | ------------------------------------------------------------------- |
| `#HOVER`     | 2       | Cruising altitude above the average terrain surface                 |
| `#DEADBAND`  | 3       | Min. height difference before a climb/descent is triggered          |
| `#SAMEGAP`   | 50      | Min. flat blocks before sloping again in the **same** direction     |
| `#TURNGAP`   | 50      | Min. flat blocks before **reversing** direction                     |
| `#AHEAD`     | 160     | How far ahead of the cart the **rails** are built                   |
| `#GENAHEAD`  | 192     | How far ahead of the rail head the **world is generated** (≥ ~64)   |
| `#MAXTICK`   | 30      | Max track columns built per game tick                               |
| `#UPCLAMP`   | 100     | How hard approaching mountains may pull the average up              |
| `#DOWNCLAMP` | 100     | How hard dips pull the average down (small = level bridges)         |

`#SAMEGAP` and `#TURNGAP` are the two knobs from the design: raise them for
longer flats and bigger, rarer 45° swoops (with more terrain punched through as
tunnels/bridges); lower them for a track that hugs the ground more closely with
more frequent slopes. Because each change is always a single unbroken 45° line,
the ride never micro-stutters regardless of how they're set.

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
