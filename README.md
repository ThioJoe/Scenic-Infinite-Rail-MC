# MC Slow TV Rail

An infinite, relaxing, cinematic minecart ride through Minecraft's procedurally
generated landscapes — inspired by "Slow TV" train journey videos. You sit in a
perpetually moving minecart on an endless powered-rail line heading due east,
gliding over plains, bridging ravines and oceans, and tunneling through
mountains, forever.

**100% vanilla.** This is a single data pack — no mods, no plugins, no resource
packs.

## Requirements

- Minecraft: Java Edition, **data-pack format 82 through 107** — the 25w31a-era
  format scheme through **26.2**. The manifest declares that full span, so the
  in-game GUI accepts it without the "made for a different version" warning.
- Cheats are optional: the ride starts by itself in a fresh world. You only
  need cheats to stop it, restart it somewhere else, or tweak it live.
- No experiments to toggle: the pack enables the **Minecart Improvements**
  feature itself (via `pack.mcmeta`), which is what the fast-over-ocean speed-up
  relies on.

> **Note on version numbers:** these are *data pack* format numbers, a
> **separate series** from *resource pack* format numbers (for 26.1, data format
> 101 vs resource format 84). `pack.mcmeta` declares `pack_format: 84` with
> `min_format: 82` / `max_format: 107`, covering the 25w31a format scheme up to
> 26.2. To extend support to a newer release, raise `max_format` (and the
> overlay's `max_format`, below) to that version's data-pack number.
>
> **Snake_case gamerules (25w44a+):** snapshot 25w44a (data format **92**)
> renamed every gamerule to snake_case. The pack handles both eras with a
> `pack.mcmeta` **overlay**: the base files use the old camelCase names (formats
> 82–91) and the `overlay_snake` folder transparently swaps in the snake_case
> versions on format 92+. Nothing to configure — the game picks the right set by
> version.

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
- **Butter-smooth camera (the ride rig)** — you sit in a real minecart, but
  it isn't the one on the rails: your cart is glued to an invisible,
  client-interpolated **camera seat** (an `item_display`) and glides *off*
  the rails along a **smoothed path computed from the track's own recorded
  profile**. Because the pack builds the track, it knows every slope in
  advance: climbs are literally *descents played in reverse* — the camera
  lifts off before the hill, eases up it, and decelerates level onto the
  summit before the rail even gets there — while descents ease down on the
  same reactive glide. The camera never sinks into terrain and the cart never
  bounces, tilts or shifts against your view (you, the cart and the camera
  move as one rigid unit, and the cart is locked perfectly horizontal to prevent tilting). You mount **once** at ride start and
  are never remounted, so there are no visible transitions and no repeated
  "press ⇧ to dismount" hints. Meanwhile a hidden **pace cart** rides the
  physical rails ~64 blocks behind you and sets the speed — however fast the
  rails push it — so the ride inherits genuine cart pace without any of its
  bounce. You keep full free-look the whole time (this is the vanilla-Java
  answer to Bedrock's `/camera`, which doesn't exist on Java — and unlike
  `/camera`, it doesn't lock your view).
- **Carts that can't be hijacked** — an invisible "plug" entity permanently
  occupies the pace cart, and you occupy your own. Occupied minecarts can't
  scoop up passing animals and can't be entered by right-click, so nothing
  ever climbs into the view. Your inventory is also continuously cleared to
  hide held items and prevent you from picking anything up.
- **Auto-start** — in a fresh world the ride begins automatically for the first
  player to appear, after a 5-second countdown to ensure chunks are loaded. It only auto-starts once per world: stopping with
  `/function infinite_rail:stop` stays stopped, even across rejoins. Set
  `#AUTOSTART` to `0` for classic manual starting.
- **Terrain smoothing** — an invisible track head runs up to `#AHEAD` (224)
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
- **Tunnels** — every column also carves a clearance bore above the rail, 3
  wide and `#TUNNEL` (4) blocks tall by default. When a mountain rises faster
  than the spacing constants allow the rail to climb, the line naturally
  continues straight into the rock as a clean tunnel until it breaks out the
  other side ("punch through instead of going over it"). An invisible vanilla
  light block is embedded above the rail in every column, so tunnels are gently
  lit and nothing can spawn on the track.
- **Speeds up over open ocean** — a long sea crossing is the one stretch with
  nothing to look at, so the ride quietly accelerates over open water. Once
  you've crossed `#OCEANCHUNKS` (6) chunks in a row of ocean biome (sampled at
  your own position), the vanilla minecart max-speed gamerule is raised to
  `#OCEANSPEED` (32); after `#LANDCHUNKS` (4) consecutive non-ocean chunks it
  eases back to the default. (This rides on the **Minecart Improvements**
  feature, which the pack enables itself — nothing to toggle; set `#OCEANSPEED`
  to 0 to turn the speed-up off.)
- **Forced generation ahead, aggressive unloading behind** — the pack
  `forceload`s terrain `#GENAHEAD` blocks ahead of the track head so the scanner
  always has real heightmap data, and removes forceloads a few hundred blocks
  behind. Note the two independent look-ahead distances: `#AHEAD` is how far
  ahead of the *cart* the rails are laid, and `#GENAHEAD` is how far ahead of the
  *rail head* the world is generated (so terrain exists roughly
  `#AHEAD + #GENAHEAD` blocks ahead of the cart). World spawn (with
  `spawnChunkRadius 0`) and your respawn point roll forward with the ride, so
  nothing stays loaded behind you.
- **Spectator constraints** — you're switched to Adventure mode with max
  Resistance and Saturation, so you can look around freely but can't break the
  track, get hurt, or starve, with true invulnerability from damage gamerules.
  Tile drops, mob griefing and fire tick are disabled so the scenery can't
  blow up the line. On **Bedrock Edition** the held-item hand is also
  auto-hidden for an unobstructed view (this is a no-op on Java, where your
  inventory is kept empty anyway).

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

| Constant       | Default | Meaning                                                             |
| -------------- | ------- | ------------------------------------------------------------------- |
| `#HOVER`       | 2       | Cruising altitude above the average terrain surface                 |
| `#TUNNEL`      | 4       | Tunnel / clearance-bore height carved above the rail (≥ 3)          |
| `#CAMHEIGHT`   | 0       | **Extra** rig height above the rail line, in tenths of a block      |
| `#CAMBLEND`    | 6       | S-curve blend length (blocks, even) at every slope change           |
| `#CAMSMOOTH`   | 6       | Descent glide: camera closes 1/N of a downward gap per tick         |
| `#CAMLIFT`     | 20      | Climb float (tenths): height above the rail while climbing          |
| `#CAMAHEAD`    | 64      | How far the viewer rides ahead of the hidden pace cart              |
| `#AUTOSTART`   | 1       | 1 = ride starts itself in a fresh world; 0 = manual start           |
| `#MAXSPEED`    | 8       | Default minecart max-speed gamerule, set once at ride start         |
| `#OCEANSPEED`  | 32      | Minecart max-speed over open ocean (0 = disable the ocean speed-up) |
| `#OCEANCHUNKS` | 6       | Consecutive ocean chunks before speeding up to `#OCEANSPEED`        |
| `#LANDCHUNKS`  | 4       | Consecutive non-ocean chunks before reverting to `#MAXSPEED`        |
| `#DEADBAND`    | 3       | Min. height difference before a climb/descent is triggered          |
| `#SAMEGAP`     | 25      | Min. flat blocks before sloping again in the **same** direction     |
| `#TURNGAP`     | 40      | Min. flat blocks before **reversing** direction                     |
| `#AHEAD`       | 224     | How far ahead of the pace cart the **rails** are built (< ~250)     |
| `#GENAHEAD`    | 192     | How far ahead of the rail head the **world is generated** (≥ ~64)   |
| `#MAXTICK`     | 15      | Max track columns built per game tick                               |
| `#UPCLAMP`     | 150     | How hard approaching mountains may pull the average up              |
| `#DOWNCLAMP`   | 50      | How hard dips pull the average down (small = level bridges)         |
| `#DEBUGMODE`   | 0       | 1 = print chat messages about the minecart-speed / ocean system     |

`#SAMEGAP` and `#TURNGAP` are the two knobs from the design: raise them for
longer flats and bigger, rarer 45° swoops (with more terrain punched through as
tunnels/bridges); lower them for a track that hugs the ground more closely with
more frequent slopes. Because each change is always a single unbroken 45° line,
the ride never micro-stutters regardless of how they're set — and since the
camera glide erases the flat→slope corners entirely, the defaults now lean
toward more frequent, smaller changes than they used to.

`#CAMBLEND`, `#CAMLIFT` and `#CAMSMOOTH` are the feel of the ride. The blend
is the S-curve length: at every slope change the camera transitions between
level and parallel-with-the-track over exactly that many blocks — it does
*not* stretch across whole slopes; between blends the camera just rides
parallel. The lift is how high the camera floats above the rails while
climbing, which doubles as the crest budget: it reaches the summit level that
many blocks early and glides level over the top (bigger = smoother hilltops,
floatier climbs). The smooth value is the reactive glide used only on the way
*down* (drops into valleys). `#CAMHEIGHT` is extra rig height above the rail
line — 0 rests your cart on the line exactly like a real cart on a rail.
`#CAMAHEAD` is where the hidden pace cart trails behind you; raise it to push
that cart further out of sight when looking backward.

`#MAXSPEED` is the vanilla minecart max-speed gamerule
(`minecartMaxSpeed` / `max_minecart_speed`, whichever your version uses),
applied **once** at ride start as the on-land default — it isn't re-enforced, so
you're free to `/gamerule` a different speed while over land. The default is 8
(vanilla). Over long ocean crossings the ride raises it to `#OCEANSPEED` after
`#OCEANCHUNKS` chunks of ocean biome (re-asserted the whole way, so the config
value always wins), then eases back to `#MAXSPEED` after `#LANDCHUNKS` chunks of
anything else (set `#OCEANSPEED` to 0 to disable). This all works out of the box:
the pack turns on the **Minecart Improvements** feature itself (via
`pack.mcmeta`), so the gamerule always exists — no experiment to enable. If a
speed change ever seems not to take, set **`#DEBUGMODE` to 1**: the ride prints
the speed it's setting, the ocean/land chunks it crosses (with the running
counters, until they hit the threshold), and the pace cart's *actual* speed each
chunk. `#TUNNEL` sets how tall each column's carved bore is — raise it for airier
tunnels and cuttings, keep it at least 3 so the tunnel light still fits.

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

The smooth camera is a rigid riding stack — player in a real (off-rail)
minecart, which rides an invisible `item_display` — teleported along the
smoothed path every tick (Java has no `/camera` command — that's
Bedrock-only — so this is the vanilla-Java equivalent, with free-look). As
the builder lays track it appends every column's rail height to a
command-storage list; each tick the camera averages that profile over a
window centered on the rig (interpolated by the pace cart's sub-block X, all
in fixed-point milliblock scoreboard math), clamps it to never dip below the
rail line, and teleports the seat there through a function macro run at the
pace cart (relative X, absolute Y — full double precision forever), with
`teleport_duration` making the client interpolate each hop. The player mounts
exactly once per ride, so no vehicle-transition artifacts ever appear.
