# MC Slow TV Rail

An infinite, relaxing, cinematic minecart ride through Minecraft's procedurally
generated landscapes — inspired by "Slow TV" train journey videos. You sit in a
perpetually moving minecart on an endless rail line heading due east, gliding
over plains, bridging ravines and oceans, and tunneling through mountains,
forever.

**100% vanilla, on both editions.** One codebase produces two packs:

- **Java Edition** — a single data pack. No mods, no plugins, no resource pack.
- **Bedrock Edition** — one add-on (a behavior pack plus a tiny resource pack
  that defines the invisible camera seat) using only the built-in Script API.
  No experiments to enable, no third-party anything.

Both share the same terrain-following algorithm — literally the same
`.mcfunction` files for the decision logic (see `BUILDING.md`) — so the track
they lay and the ride they give are the same.

## Getting the packs

Grab the latest build from the repository's **GitHub Actions artifacts**
(`InfiniteRail-Java-N` is the ready-to-use datapack folder,
`InfiniteRail-Bedrock-N` contains the `.mcaddon`), or from a **Release** if
one is published — or build
both locally with `node tools/build.mjs` (see `BUILDING.md`).

## Java Edition

### Requirements

- Minecraft: Java Edition, **data-pack format 82 through 107** — the 25w31a-era
  format scheme through **26.2**. The manifest declares that full span, so the
  in-game GUI accepts it without the "made for a different version" warning.
- Cheats are optional: the ride starts by itself in a fresh world. You only
  need cheats to stop it, restart it somewhere else, or tweak it live.
- No experiments to toggle: the pack enables the **Minecart Improvements**
  feature itself (via `pack.mcmeta`), which is what the fast-over-ocean
  speed-up relies on.

> **Note on version numbers:** these are *data pack* format numbers, a
> **separate series** from *resource pack* format numbers (for 26.1, data
> format 101 vs resource format 84). `pack.mcmeta` declares `pack_format: 84`
> with `min_format: 82` / `max_format: 107`, covering the 25w31a format scheme
> up to 26.2. To extend support to a newer release, raise `max_format` (and
> the overlay's `max_format`, below) to that version's data-pack number.
>
> **Snake_case gamerules (25w44a+):** snapshot 25w44a (data format **92**)
> renamed every gamerule to snake_case. The pack handles both eras with a
> `pack.mcmeta` **overlay**: the base files use the old camelCase names
> (formats 82–91) and the `overlay_snake` folder transparently swaps in the
> snake_case versions on format 92+. Nothing to configure — the game picks the
> right set by version.

### Installation

1. Create a new world (any seed; cheats ON). A fresh world is strongly
   recommended since the ride permanently modifies terrain along its path.
2. Copy the built `infinite_rail` folder (or the `InfiniteRail-Java-*.zip`)
   into the world's `datapacks` folder, or add it via the **Data Packs**
   screen during world creation.
3. Enter the world. **The ride starts by itself** the moment you spawn in — no
   command needed.

To start it manually (or restart it at a new location later):

```
/function infinite_rail:start
```

To end the ride:

```
/function infinite_rail:stop
```

(This stops the builder and removes the cart; run `/gamemode creative` if you
want to move around afterward.)

## Bedrock Edition

### Requirements

- Minecraft: Bedrock Edition **1.21.120 or newer** (any current release —
  the pack pins the stable `@minecraft/server 2.3.0` scripting module, which
  every newer version still provides).
- **No experiments.** The Script API used here is the stable one.
- Cheats/commands only if you want to stop, restart, or tweak the ride —
  auto-start needs nothing.

### Installation

1. Double-click (or open) `InfiniteRail-Bedrock-v*.mcaddon` — Minecraft
   imports both halves (the behavior pack and its resource pack)
   automatically.
2. Create a new world — cheats are **not required**, but recommended so you
   can control the ride. In the world's **Behavior Packs** screen, activate
   *Infinite Rail (Slow TV)*; the resource pack is pulled in automatically as
   its dependency.
3. Enter the world. The ride starts by itself after a short countdown.

Manual control (note the `/` instead of Java's `:`):

```
/function infinite_rail/start
/function infinite_rail/stop
```

Press **F1** (or Hide GUI) for the full ambient experience on either edition.

### Bedrock-specific notes

- **You keep native first-person free-look.** Your cart rides an invisible
  scripted seat that is glided along the smoothed path (the same rig design
  as Java), so the camera is simply your normal one. An optional cinematic
  mode (`.CAMMODE 1`, see Tuning) hands the view to Bedrock's native camera
  system instead: the position is eased along the path for extra glide, at
  the cost of your look input reaching the camera a beat late.
- **The ride eases off if world generation falls behind** and speeds back up
  once terrain ahead is ready — it never builds a column before the terrain
  it needs to scan exists, and never outruns the built track.
- **A ride survives quitting and rejoining the world** mid-journey — the
  script saves its state continuously and resumes where it left off.
- **The support block under the rail is visibly a block of redstone** when
  seen from the side (bridges). Java disguises it with a display entity;
  Bedrock has no display entities, so the port doesn't hide it. You won't see
  it while riding.
- **There is no hidden pace cart behind you** — Bedrock's port computes the
  pace virtually, so nothing is visible looking backward either.
- The ocean speed-up drives the scripted cart speed directly (Bedrock has no
  minecart max-speed gamerule); same chunks-of-ocean trigger logic, same
  knobs, and the speed change eases in and out smoothly.

## What it does

- **Perpetual motion** — the track is built exclusively from always-powered
  rails. Each rail sits directly on a **block of redstone**, which powers it,
  is immune to water, and emits no light — so the power source can never be
  washed away by oceans/rivers or melt the surrounding ice, even skimming low
  over water. On Java the redstone block is disguised as smooth stone by a
  **block display**, so from the side (e.g. on a bridge) it reads as a plain
  stone support. Per-tick keepers guarantee the ride never ends: if the cart
  ever stalls it is re-boosted, and if the rider ever dismounts they are put
  straight back on the ride.
- **Butter-smooth camera (the ride rig)** — you sit in a real minecart, but
  it isn't riding the rails: your cart glides *off* the rails along a
  **smoothed path computed from the track's own recorded profile**. Because
  the pack builds the track, it knows every slope in advance: climbs are
  literally *descents played in reverse* — the camera lifts off before the
  hill, eases up it, and decelerates level onto the summit before the rail
  even gets there — while descents ease down on the same reactive glide. The
  camera never sinks into terrain and the cart never bounces, tilts or shifts
  against your view. You mount **once** at ride start and are never
  remounted, so there are no visible transitions and no repeated "press ⇧ to
  dismount" hints. On Java an invisible, client-interpolated camera seat
  carries your cart while a hidden **pace cart** rides the physical rails
  ~64 blocks behind you and sets the speed; on Bedrock the script glides the
  cart directly and paces it virtually. You keep full free-look the whole
  time, on both editions.
- **Carts that can't be hijacked** — occupied minecarts can't scoop up
  passing animals and can't be entered by right-click, so nothing ever climbs
  into the view (Java's hidden pace cart is permanently occupied by an
  invisible "plug" entity for the same reason). Your inventory is also
  continuously cleared to hide held items and prevent you from picking
  anything up.
- **Auto-start** — in a fresh world the ride begins automatically for the
  first player to appear, after a 5-second countdown to ensure chunks are
  loaded. It only auto-starts once per world: stopping with the stop command
  stays stopped, even across rejoins. Set `#AUTOSTART` to `0` for classic
  manual starting.
- **Terrain smoothing** — an invisible track head runs up to `#AHEAD` (224)
  blocks ahead of the cart. For every column it samples the terrain surface at
  12 points across the next 48 blocks and maintains a rolling average,
  steering the rail toward *average terrain + `#HOVER` blocks*. Approaching
  mountains raise the average early, so climbs start well in advance and
  ascend in one smooth swoop.
- **The "event" model (no stair-stepping)** — the rail is never stepped up one
  block, held flat, then stepped up again. Instead every elevation change is a
  single continuous **45° line** — consecutive ascending rails, corner to
  corner — that runs until it reaches the target height, however many blocks
  that is, and then the rail goes flat. A 12-block rise is one clean diagonal,
  not twelve little steps. Two spacing constants shape how big and how
  frequent these changes are: `#SAMEGAP` (minimum flat distance before sloping
  *again in the same direction*) and `#TURNGAP` (minimum flat distance before
  *reversing* direction). When terrain would demand a change sooner than the
  gaps allow, the rail simply holds its height instead — which is exactly what
  produces the bridges and tunnels below.
- **Bridges** — every rail carries its own support column, so whenever the
  ground drops away (ravines, valleys, oceans, lava lakes) the line simply
  becomes a slender floating bridge at cruising altitude. Sudden narrow dips
  are deliberately ignored by the smoother and, if a descent is forbidden by
  `#TURNGAP`/`#SAMEGAP`, the rail holds level and bridges straight across.
- **Tunnels** — every column also carves a clearance bore above the rail, 3
  wide and `#TUNNEL` blocks tall. When a mountain rises faster than the
  spacing constants allow the rail to climb, the line naturally continues
  straight into the rock as a clean tunnel until it breaks out the other side
  ("punch through instead of going over it"). An invisible vanilla light block
  is embedded above the rail in every column, so tunnels are gently lit and
  nothing can spawn on the track.
- **Speeds up over open ocean** — a long sea crossing is the one stretch with
  nothing to look at, so the ride quietly accelerates over open water. Once
  you've crossed `#OCEANCHUNKS` (6) chunks in a row of ocean biome (sampled at
  your own position), the ride speed rises to `#OCEANSPEED` (32); after
  `#LANDCHUNKS` (4) consecutive non-ocean chunks it eases back to the default.
  (On Java this rides on the **Minecart Improvements** max-speed gamerule,
  which the pack enables itself; on Bedrock the script drives the cart speed
  directly. Set `#OCEANSPEED` to 0 to turn the speed-up off.)
- **Forced generation ahead, aggressive unloading behind** — the pack keeps
  terrain generated `#GENAHEAD` blocks ahead of the track head so the scanner
  always has real heightmap data (Java: rolling `forceload`s; Bedrock: rolling
  ticking areas), and releases the corridor behind. World spawn and your
  respawn point roll forward with the ride, so nothing stays loaded behind
  you.
- **Spectator constraints** — you're switched to Adventure mode with max
  Resistance and Saturation, so you can look around freely but can't break the
  track, get hurt, or starve, with true invulnerability from damage gamerules.
  Tile drops, mob griefing and fire tick are disabled so the scenery can't
  blow up the line.

## Tuning

Every knob lives in one file — the **same file on both editions**, built from
`src/shared/functions/config.mcfunction`:

- Java: `data/infinite_rail/function/config.mcfunction` inside the data pack
- Bedrock: `functions/infinite_rail/config.mcfunction` inside the behavior pack

Edit a value there, then run **`/reload`** in chat (or quit and rejoin the
world) to apply it — on both editions the game only re-reads function files on
`/reload`, and a ride already in progress picks the new values up without
stopping.

> ⚠️ Running the config function directly does **not** pick up file edits —
> the game runs the copy already loaded in memory. Always use `/reload` after
> editing the file.

To experiment with a single value *without* editing the file, set its
scoreboard directly in chat. The score-holder prefix differs by edition (a
command-parser quirk; see `BUILDING.md`):

```
/scoreboard players set #HOVER ir 8    (Java)
/scoreboard players set .HOVER ir 8    (Bedrock)
```

Live scoreboard edits take effect on the very next track column (change
`#HOVER` mid-ride and the rail smoothly migrates to the new altitude). They're
temporary — a reload or rejoin resets everything to the values in the config
file, which are therefore your permanent defaults.

| Constant       | Default | Meaning                                                             |
| -------------- | ------- | ------------------------------------------------------------------- |
| `#HOVER`       | 2       | Cruising altitude above the average terrain surface                 |
| `#TUNNEL`      | 6       | Tunnel / clearance-bore height carved above the rail (≥ 3)          |
| `#CAMHEIGHT`   | 0       | **Extra** rig height above the rail line, in tenths of a block      |
| `#CAMBLEND`    | 6       | S-curve blend length (blocks, even) at every slope change           |
| `#CAMSMOOTH`   | 6       | Descent glide: camera closes 1/N of a downward gap per tick         |
| `#CAMLIFT`     | 20      | Climb float (tenths): height above the rail while climbing          |
| `#CAMAHEAD`    | 64      | How far the viewer rides ahead of the (hidden/virtual) pace cart    |
| `#CAMMODE`     | 0       | **Bedrock only**: 0 = native free-look rig, 1 = eased cinematic cam |
| `#AUTOSTART`   | 1       | 1 = ride starts itself in a fresh world; 0 = manual start           |
| `#MAXSPEED`    | 8       | Default ride speed in blocks/s (Java: minecart max-speed gamerule)  |
| `#OCEANSPEED`  | 32      | Ride speed over open ocean (0 = disable the ocean speed-up)         |
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
| `#DEBUGMODE`   | 0       | 1 = print chat messages about the speed / ocean system              |

`#SAMEGAP` and `#TURNGAP` are the two knobs from the design: raise them for
longer flats and bigger, rarer 45° swoops (with more terrain punched through as
tunnels/bridges); lower them for a track that hugs the ground more closely with
more frequent slopes. Because each change is always a single unbroken 45° line,
the ride never micro-stutters regardless of how they're set — and since the
camera glide erases the flat→slope corners entirely, the defaults lean toward
more frequent, smaller changes than they used to.

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
`#CAMAHEAD` is where the pace position trails behind you; on Java, raise it to
push the hidden pace cart further out of sight when looking backward.

`#MAXSPEED` is the on-land cruising speed in blocks/second (vanilla cart speed
is 8). On Java it is the vanilla minecart max-speed gamerule
(`minecartMaxSpeed` / `max_minecart_speed`, whichever your version uses),
applied **once** at ride start — you're free to `/gamerule` a different speed
while over land, and the pack turns on the required **Minecart Improvements**
feature itself. On Bedrock the script eases the cart toward this speed
continuously, so live-tweaking `.MAXSPEED` changes your pace within seconds.
Over long ocean crossings the ride raises the speed to `#OCEANSPEED` after
`#OCEANCHUNKS` chunks of ocean biome (re-asserted the whole way, so the config
value always wins), then eases back after `#LANDCHUNKS` chunks of anything
else. If a speed change ever seems not to take, set **`#DEBUGMODE` to 1**: the
ride prints the speed it's setting, the ocean/land chunks it crosses (with the
running counters), and the cart's actual speed. `#TUNNEL` sets how tall each
column's carved bore is — raise it for airier tunnels and cuttings, keep it at
least 3 so the tunnel light still fits.

## Limitations

- Commands can unload chunks but cannot delete them from disk, so the world
  folder still grows slowly on long rides. Memory usage stays flat — passed
  chunks are fully unloaded.
- The ride is designed for a single viewer (one cart, one rider).
- Start it in the Overworld; the Nether's bedrock ceiling confuses surface
  heightmaps.

## How it's built

See **`CONTEXT.md`** for the full technical reference — the architecture, the
shared state, every file, and the algorithms — including section 11 on how the
Java and Bedrock versions share one brain, and **`BUILDING.md`** for the
monorepo layout and build workflow.

On Java, everything runs from `#minecraft:tick`: a `marker` entity is the
track head; a probe marker is teleported around with `execute positioned over
motion_blocking_no_leaves` to read the world heightmap into scoreboards; and
the smooth camera is a rigid riding stack — player in a real (off-rail)
minecart, riding an invisible `item_display` — teleported along the smoothed
path every tick through function macros, with `teleport_duration` making the
client interpolate each hop (Java has no `/camera` command, so this is the
vanilla-Java equivalent, with free-look). As the builder lays track it appends
every column's rail height to a command-storage list; each tick the camera
averages that profile over a window centered on the rig, all in fixed-point
milliblock scoreboard math.

On Bedrock, the same jobs run in `scripts/main.js` on the stable Script API:
`getTopmostBlock()` replaces the probe-marker heightmap trick, a plain
JavaScript array replaces the command-storage profile list, ordinary
floating-point math replaces the milliblock arithmetic, velocity-driven
motion replaces the interpolated-teleport seat, and a virtual pace position
replaces the hidden pace cart entirely. The slope decisions themselves — the
event model — are the **same shared `.mcfunction` files** on both editions,
talking to each engine through two scoreboard integers.
