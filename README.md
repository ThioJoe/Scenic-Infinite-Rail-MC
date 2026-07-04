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
- Cheats are optional: the ride starts by itself in a fresh world. You only
  need cheats to stop it, restart it somewhere else, or tweak it live.

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
3. Enter the world. **The ride starts by itself** the moment you spawn in — no
   command needed.

If you'd rather start it manually (or restart it at a new location later), set
`#AUTOSTART` to `0` in the config (see Tuning) and/or run:

```
/function infinite_rail:start
```

That's it. The ride begins at your location, heading east. Press **F1** for the full ambient experience.

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
  dismounts they are put straight back on the ride.
- **Butter-smooth hybrid camera** — on flat track you sit in the real
  minecart, so the ride looks and feels exactly like riding a cart. Around
  every elevation change you're switched — seamlessly, at identical eye
  height — onto an invisible gliding **camera seat** (an `item_display` with
  client-side teleport interpolation) that follows the cart's exact X/Z (the
  cart always sets the pace, however fast the rails push it) while its height
  flies a **pre-smoothed S-curve computed from the track's own recorded
  profile**. Because the pack builds the track, it knows every slope in
  advance: climbs start rising *before* the corner and the camera rides
  exactly parallel to steady 45° runs with zero lag — it never sags into the
  cart's tilted model or into the ground. Descents use a reactive exponential
  glide. Once the track flattens out, you're handed back to the real cart.
  You keep full free-look the whole time (this is the vanilla-Java answer to
  Bedrock's `/camera`, which doesn't exist on Java — and unlike `/camera`, it
  doesn't lock your view). You're made invisible so no floating body
  photobombs the view while you're on the seat.
- **A cart that's never hijacked** — an invisible "plug" entity always
  occupies whichever perch you don't (the cart while you're on the camera
  seat, the seat while you're in the cart). An occupied minecart can't scoop
  up passing animals and can't be entered by right-click, so nothing ever
  blocks the view — and the cart keeps passenger physics at all times, so its
  speed is identical in both modes.
- **Auto-start** — in a fresh world the ride begins automatically for the first
  player to appear. It only auto-starts once per world: stopping with
  `/function infinite_rail:stop` stays stopped, even across rejoins. Set
  `#AUTOSTART` to `0` for classic manual starting.
- **Terrain smoothing** — an invisible track head runs up to `#AHEAD` (160)
  blocks ahead of the cart. For every column it samples the vanilla terrain
  heightmap at 12 points across the next 48 blocks and maintains a rolling
  average, steering the rail toward *average terrain + `#HOVER` blocks*. Approaching mountains raise the
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
Edit a value there, then run **`/reload`** in chat (or quit and rejoin the
world) to apply it. Minecraft only re-reads `.mcfunction` files from disk on
`/reload`; it then runs `config` automatically, updating a ride already in
progress without stopping it.

> ⚠️ `/function infinite_rail:config` on its own does **not** pick up file
> edits — the game runs the copy already loaded in memory, so you'll just re-run
> the old values. Always use `/reload` after editing the file. (Running `config`
> directly is only useful to reset the live tweaks below back to the file's
> values.)

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
| `#CAMHEIGHT` | 0       | **Extra** camera height over the normal in-cart seat, in tenths     |
| `#CAMWINDOW` | 8       | Camera lookahead (blocks each side, even): the S-curve reach        |
| `#CAMSMOOTH` | 4       | Descent glide: camera closes 1/N of a downward gap per tick         |
| `#AUTOSTART` | 1       | 1 = ride starts itself in a fresh world; 0 = manual start           |
| `#DEADBAND`  | 2       | Min. height difference before a climb/descent is triggered          |
| `#SAMEGAP`   | 5       | Min. flat blocks before sloping again in the **same** direction     |
| `#TURNGAP`   | 40      | Min. flat blocks before **reversing** direction                     |
| `#AHEAD`     | 160     | How far ahead of the cart the **rails** are built                   |
| `#GENAHEAD`  | 192     | How far ahead of the rail head the **world is generated** (≥ ~64)   |
| `#MAXTICK`   | 15      | Max track columns built per game tick                               |
| `#UPCLAMP`   | 75      | How hard approaching mountains may pull the average up              |
| `#DOWNCLAMP` | 25      | How hard dips pull the average down (small = level bridges)         |

`#SAMEGAP` and `#TURNGAP` are the two knobs from the design: raise them for
longer flats and bigger, rarer 45° swoops (with more terrain punched through as
tunnels/bridges); lower them for a track that hugs the ground more closely with
more frequent slopes. Because each change is always a single unbroken 45° line,
the ride never micro-stutters regardless of how they're set — and since the
camera glide erases the flat→slope corners entirely, the defaults now lean
toward more frequent, smaller changes than they used to.

`#CAMWINDOW` and `#CAMSMOOTH` are the feel of the ride: the window is how far
the camera reads the recorded track profile to each side of the cart — climbs
start easing in about that many blocks *before* the corner (bigger = softer,
earlier, floatier; 0 turns the camera system off entirely). The smooth value
is the reactive glide used when the camera needs to come *down* (into
descents, settling after a crest); climbs never lag, so they can't sag the
camera into the cart or the ground. `#CAMHEIGHT` is extra height over the
normal in-cart seating position — 0 looks exactly like sitting in the cart.

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

The smooth camera is an invisible `item_display` the player rides around
slopes (Java has no `/camera` command — that's Bedrock-only — so this is the
vanilla-Java equivalent). As the builder lays track it appends every column's
rail height to a command-storage list; each tick the camera averages that
profile over a window centered on the cart (interpolated by the cart's
sub-block X, all in fixed-point milliblock scoreboard math), clamps it to
never dip below the rail line, and teleports the seat there through a function
macro, with `teleport_duration` making the client interpolate each hop. A
one-time calibration measures exactly how high a passenger sits in the cart,
so handing the player between cart and seat never moves the camera.
