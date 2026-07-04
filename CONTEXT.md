# CONTEXT.md — How the Infinite Rail data pack works

A complete technical reference for the project: the architecture, the shared
state, every file, and the algorithms. Written for a developer (or an AI) who
needs to understand or modify the pack. For player-facing usage see `README.md`.

---

## 1. What it is

A **100% vanilla Minecraft: Java Edition data pack** (no mods, no resource pack)
that turns the game into an endless, relaxing "Slow TV" minecart ride. The ride
starts by itself in a fresh world (or via one command): the player is placed on
a self-building, permanently-powered rail line heading **due east forever**,
while an algorithm lays smooth track over the procedurally generated terrain —
bridging valleys and oceans, tunneling through mountains, and hovering a few
blocks above the ground the rest of the time. The player sits in a real
minecart — but not the one on the rails: their cart is glued to an invisible,
interpolated **camera seat** that flies a pre-smoothed S-curve computed from
the track's own recorded profile, while a hidden **pace cart** rides the
physical rails behind them and sets the speed. Slope corners and rail physics
never reach the player's eyes, and they mount exactly once per ride (§7g).

Everything is driven by `.mcfunction` files and a single scoreboard. There is no
Java, no external process. Target versions: **Java 1.21 through 26.2** (see
`pack.mcmeta`).

Key design facts to keep in mind while reading:

- **The world is one-dimensional in travel.** The cart only ever moves in **+X
  (east)**. Z is fixed (the track never turns). Y is what the algorithm decides.
- **The "column"** is the unit of work: one X-slice of track (a rail, its
  support below, a light above, and carved air around). The pack builds columns
  one at a time, ahead of the cart.
- **All shared state lives in one scoreboard objective, `ir`.** Values are held
  on fake players whose names start with `#` (a convention for "not a real
  player / internal variable"). There are no data structures beyond that and a
  little command storage.

---

## 2. Data pack anatomy & how Minecraft bootstraps it

```
infinite_rail/
  pack.mcmeta                                   # pack metadata + version compat
  data/
    minecraft/tags/function/
      load.json                                 # vanilla hook: run on load/reload
      tick.json                                 # vanilla hook: run every tick
    infinite_rail/function/
      *.mcfunction                              # all the logic (namespace: infinite_rail)
```

Minecraft discovers a data pack by its `pack.mcmeta`. Two **vanilla function
tags** are the only entry points the game calls on its own:

- `#minecraft:load` → lists `infinite_rail:load`. The game runs it **once when
  the world loads and again on every `/reload`.** This is where the pack
  initializes.
- `#minecraft:tick` → lists `infinite_rail:tick`. The game runs it **every game
  tick (20×/second).** This is the pack's heartbeat.

Everything else is a normal function reached by `function infinite_rail:<name>`
calls, or by the player running `/function infinite_rail:start` / `:stop`.

> **Important behavior:** the game loads every `.mcfunction` into memory at
> load/`/reload` time. Editing a file on disk does **not** change the running
> game until `/reload` (or a world rejoin). This is why `config` is applied via
> `/reload`, not by re-running the `config` function (see §6 and README).

---

## 3. Coordinate & geometry conventions

- **+X = east = the direction of travel.** The head advances in +X.
- **Z is constant** — the centerline of the track. It never changes after start.
- **Y** is the elevation the algorithm chooses per column.
- **The head marker** (`ir_head`, §4) sits at the current build position:
  `(headX + 0.5, railY, centerZ + 0.5)` — block-centered in X/Z, integer Y. Most
  build commands `execute ... at @e[ir_head]` and then use `~` relative
  coordinates, so in the place/support/sample functions:
  - `~` = the rail's cell (Y = railY)
  - `~-1` = one below the rail (the support / redstone block)
  - `~3` = three above the rail (the light block)
  - `~4` / `~5` = top of the carved clearance
  - `~-8 .. ~8` in Z (forceload) = ±1 chunk around the centerline

A single **column** therefore looks like this vertically (flat case):

```
  railY+4 .. railY+1   air (carved clearance / tunnel bore)
  railY+3              minecraft:light[level=11]   (lights tunnels, blocks mob spawns)
  railY                minecraft:powered_rail (always powered)
  railY-1              minecraft:redstone_block   (powers the rail; disguised as smooth_stone by a block_display)
```

Consecutive columns differ in X by 1. On slopes they also differ in Y by 1,
producing a 45° "corner-to-corner" line of ascending rails (see §7c).

---

## 4. Shared state

### 4.1 The `ir` scoreboard objective

A single `dummy` objective named `ir` holds every variable. All are on `#`-named
fake players. Grouped by role:

**Tunable config knobs** (set by `config.mcfunction`; see §8):

| Score        | Meaning |
| ------------ | ------- |
| `#HOVER`     | Preferred rail clearance (blocks) above the average terrain surface. |
| `#CAMHEIGHT` | **Extra** rig height above the rail line, in **tenths of a block** (0 = the ride cart rests on the smoothed line like a cart on a rail). |
| `#CAMBLEND`  | S-curve blend length in blocks (even): the camera transitions level⇄parallel over exactly this distance at every slope change. |
| `#CAMSMOOTH` | Descent glide divisor: the camera closes `1/#CAMSMOOTH` of a **downward** gap per tick (climbs use the constructed S-curve instead; 1 = off). |
| `#CAMLIFT`   | Climb float / crest budget, in **tenths of a block**: how high the camera rides above the rail line while climbing, and how early it reaches the summit level. |
| `#CAMAHEAD`  | How many blocks the rig (viewer) rides ahead of the hidden pace cart. Keep ≥ ~40 below `#AHEAD`. |
| `#AUTOSTART` | `1` = the ride auto-starts for the first player in a fresh world; `0` = manual start only. |
| `#DEADBAND`  | Minimum `|target − railY|` before a slope change is even considered (hysteresis vs. terrain noise). |
| `#SAMEGAP`   | Minimum flat columns between two elevation changes **in the same direction**. |
| `#TURNGAP`   | Minimum flat columns before the rail may **reverse** direction. |
| `#UPCLAMP`   | Max a single heightmap sample may pull the rolling average **up** per column. |
| `#DOWNCLAMP` | Max a single heightmap sample may pull the rolling average **down** per column. |
| `#AHEAD`     | How far (blocks) ahead of the **cart** the rails are kept built. |
| `#GENAHEAD`  | How far (blocks) ahead of the **rail head** terrain is force-generated. |
| `#MAXTICK`   | Max columns built per game tick (catch-up budget). |

**Internal constants** (set by `load.mcfunction`, kept out of user config):

| Score   | Meaning |
| ------- | ------- |
| `#C12`  | Number of heightmap samples per column (**12**) — the divisor for the average. Fixed by `sample_window.mcfunction`; changing one without the other breaks the average. |
| `#C2`,`#C10` | Small divisors for the camera scan geometry (`#CAMBLEND/2`, `#CAMLIFT` tenths→blocks). |
| `#C100` | Fixed-point multiplier **100**: converts `#CAMHEIGHT`/`#CAMLIFT` (tenths of a block) to milliblocks. |
| `#C1000`| Fixed-point multiplier **1000**: converts whole blocks to milliblocks / extracts the cart's sub-block X fraction. |

**Runtime state:**

| Score       | Meaning |
| ----------- | ------- |
| `#started`  | `1` while a ride is active. `tick` does nothing unless this is 1. |
| `#railY`    | Current rail elevation (Y). Tracks the head marker's Y. |
| `#headX`    | Current head X (also the column counter / absolute world X of the build front). |
| `#cartX`    | The cart's current X, sampled each tick, for the build-ahead gap. |
| `#gap`      | `#headX − #cartX` — how far the build front leads the cart. |
| `#budget`   | Columns left to build this tick (starts at `#MAXTICK`, counts down). |
| `#nextLoad` | The `#headX` value at which `roll_chunks` next fires (every 16 blocks). |
| `#avg`      | Rolling average of the terrain surface from the lookahead scan. |
| `#sum`      | Accumulator for the 12 samples in `sample_window`. |
| `#s`        | One sample's Y (temporary, reused per sample). |
| `#lo`,`#hi` | Per-column clamp bounds `#avg−#DOWNCLAMP` / `#avg+#UPCLAMP`. |
| `#target`   | Desired rail Y this column = `#avg + #HOVER`. |
| `#diff`     | `#target − #railY` (how far the rail is from where it wants to be). |
| `#ndead`    | `−#DEADBAND` (temp, the negative threshold for descending). |
| `#slope`    | Direction of the **event in progress**: `-1` descending, `0` flat, `1` climbing. Persists across columns. |
| `#slope0`   | Snapshot of `#slope` taken at the top of `decide` (so mid-function mutations don't confuse the branch logic). |
| `#dir`      | **This column's** move: `-1` down, `0` flat, `1` up. Read by `advance` to place the column. |
| `#want`     | Desired direction when flat (before the spacing gaps get a say). |
| `#need`     | The gap required for the wanted change this column (`#SAMEGAP` or `#TURNGAP`). |
| `#flat`     | Flat columns counted since the last event ended (compared against `#need`). |
| `#lastDir`  | Direction of the last event (`1`/`-1`), used to pick `#SAMEGAP` vs `#TURNGAP`. |
| `#mx`       | The cart's `Motion[0]` × 100 (its eastward speed, for the stall check). |
| `#autodone` | `1` once a ride has ever been started in this world; blocks the auto-starter forever after (persists in the world save). |
| `#trackBase`| World X of index 0 of the track-history list (storage `infinite_rail:track y`). |
| `#sy`       | The rig's smoothed rail-line height this tick, in **milliblocks**: `max(#c1, #s2, #linem)`. |
| `#c1`       | The constructed S-curve height (stateless): blend-average of `lifted()` over ±`#CAMBLEND/2`. |
| `#s2`       | The reactive descent chaser (stateful): eases toward `#linem` by `1/#CAMSMOOTH` per tick. |
| `#dy`       | The chaser's step this tick. |
| `#lift`,`#wmax`,`#half` | Precomputed per tick: `#CAMLIFT`×100 (milli), the per-sample forward-scan reach (`#CAMLIFT` in blocks + 2), and `#CAMBLEND/2`. |
| `#cxm`,`#ci`,`#cmaxi`,`#fx`,`#fi` | Pace-cart X×1000, the rig's column index into the history (cart index + `#CAMAHEAD`, clamped), max valid index, sub-block X fraction (milli, floorMod) and complement — index and fraction derive from the one `#cxm` read so they can't disagree. |
| `#j`,`#cb`,`#tj`,`#tsum`,`#tn` | `cam_blend` loop state: blend offset, sample base column, one `lifted()` value, running sum/count. |
| `#k`,`#si`,`#sj`,`#ya`,`#yb`,`#sm`,`#t2` | `cam_scan`/`cam_sample` state: scan offset, clamped indices, the two column heights, the interpolated sample, scratch (also reused by `cam_move`). |
| `#fmx`,`#l0`,`#linem`,`#ly` | One sample's forward max and its rail line (milli), the rail line at the rig (milli), `cam_get` output. |

### 4.2 Entities (all tagged, so selectors are unambiguous)

| Tag        | Type            | Purpose |
| ---------- | --------------- | ------- |
| `ir_head`  | `marker`        | The build head. Its position is the current column; it advances east (and up/down on slopes) as track is laid. |
| `ir_probe` | `marker`        | A scratch probe teleported around by `sample_window` (and once by `begin`) onto the terrain surface to read heightmaps into scores. |
| `ir_cart`  | `minecart`      | The hidden **pace cart**. Invulnerable; rides the physical rails `#CAMAHEAD` blocks behind the viewer, kept moving by the stall keeper. Permanently occupied by the plug — a cart with a passenger can't scoop up mobs or be right-click entered. |
| `ir_seat`  | `item_display`  | The **camera seat** — the mover of the rig. Displays no item; `teleport_duration:1` makes the client interpolate its per-tick teleports. Teleported along the smoothed path by `cam_move` every tick; carries the ride cart. |
| `ir_ride`  | `minecart`      | The **ride cart** the player actually sits in — a real minecart, off the rails, permanently a passenger of the seat. The whole stack (seat → ride cart → player) moves rigidly, so the cart can never bounce, tilt or shift against the view. |
| `ir_plug`  | `item_display`  | The **seat-blocker**: permanently occupies the pace cart. |
| `ir_disp`  | `block_display` | One per column: a smooth-stone visual that disguises the redstone block under the rail. Purely cosmetic. |

### 4.3 Command storage

| Storage              | Path      | Purpose |
| -------------------- | --------- | ------- |
| `infinite_rail:tmp`  | `y`(double) | Scratch in `begin` to copy `#railY` into the head marker's `Pos[1]`. |
| `infinite_rail:args` | `gen`(int)  | The macro argument passed to `forceload` (the `#GENAHEAD` distance). |
| `infinite_rail:cam`  | `dx`(int), `y`(double) | Macro arguments for `cam_tp`: the eastward offset from the pace cart (`#CAMAHEAD`) and the rig's absolute height (`(#sy + 62 + #CAMHEIGHT×100) × 0.001`). X/Z stay relative to the execution position (the pace cart), so they never pass through a scoreboard. |
| `infinite_rail:track`| `y`(list of int) | The **track history**: one rail-Y per built column, appended by `advance` (and once by `begin`); index = world X − `#trackBase`. The camera's entire knowledge of the path. Grows ~4 bytes/column for the life of a ride; reset by `begin`. |
| `infinite_rail:cami` | `i`(int) | Macro argument for `cam_get` (the history index to read). |

---

## 5. Runtime flow (the big picture)

```
World load / /reload
        │
        ▼
#minecraft:load ─► infinite_rail:load ─► sets up `ir`, #C12, then infinite_rail:config
                                          (applies all tunable knobs)

Player runs /function infinite_rail:start
(or the auto-starter fires: tick starts a 5-second countdown timer for the first player to
 appear in a fresh world, while #AUTOSTART=1, #started=0 and #autodone≠1)
        │
        ▼
start ─► (as nearest player, block-aligned) begin
            ├─ reset any previous run, kill old entities, clear forceloads; #autodone=1
            ├─ setup_world (gamerules)
            ├─ summon ir_head + ir_probe markers; initial forceload (via GENAHEAD macro)
            ├─ read terrain here, set #railY = surface + #HOVER, move head to it
            ├─ init counters (#slope=0, #flat=99, #lastDir=0, seed #avg, #nextLoad…)
            ├─ reset the track-history list; #trackBase = #headX; record column 0
            ├─ place the first column; summon ir_cart (pace cart) + ir_plug; plug in cart
            ├─ pre-build #CAMAHEAD+32 columns synchronously
            ├─ summon ir_seat + ir_ride at the head; ride cart onto seat;
            │    mount player INTO THE RIDE CART (the only mount of the ride);
            │    set adventure + Resistance/Saturation
            └─ seed #sy, snap the rig into place (cam_follow), set #started = 1

Every game tick (while #started == 1)
        │
        ▼
#minecraft:tick ─► tick ─► main
                            ├─ sample #cartX (pace cart)
                            ├─ keeper: eject anything but the plug from the pace cart,
                            │    anything but players from the ride cart
                            ├─ keeper: re-mount a dismounted rider into the ride cart
                            ├─ keeper: plug→pace cart, ride cart→seat (self-healing)
                            ├─ keeper: re-boost the pace cart if stalled
                            ├─ cam_follow: fly the rig along the recorded profile,
                            │    #CAMAHEAD blocks ahead of the pace cart (§7g)
                            └─ #budget = #MAXTICK; build_loop
                                   └─ while (#budget>0 AND head−cart < #AHEAD): build_step
                                          └─ advance (build ONE column) ─► build_loop (recurse)

advance (per column)
   1. sample_window ─► #avg (rolling average of the next 48 blocks' surface)
   2. #target = #avg + #HOVER
   3. decide ─► #dir (-1/0/1)  [event model; may call consider_start]
   4. move ir_head and place the column (place_flat / place_up / place_down ─► support)
   5. every 16 blocks: roll_chunks (forceload ahead, unload behind, move spawn)

Player runs /function infinite_rail:stop
        │
        ▼
stop ─► #started=0, dismount, kill cart+markers, clear forceloads (track stays built)
```

---

## 6. File-by-file reference

### 6.1 Metadata & vanilla hooks

**`infinite_rail/pack.mcmeta`**
Pack metadata. Declares the description and version compatibility. Uses the
current (25w31a+) scheme: `pack_format` (legacy, for old clients),
`min_format` / `max_format` (the supported *data-pack* format range). `84`/`82`
/`107` cover 1.21-era through 26.2. (Data-pack format numbers are a **separate
series** from resource-pack numbers.)

**`data/minecraft/tags/function/load.json`**
Vanilla tag `#minecraft:load`; its `values` list contains `infinite_rail:load`.
Makes the game run `load` on world-load and `/reload`.

**`data/minecraft/tags/function/tick.json`**
Vanilla tag `#minecraft:tick`; lists `infinite_rail:tick`. Makes the game run
`tick` every game tick.

### 6.2 Initialization & config

**`function/load.mcfunction`**
Runs on load/reload. `scoreboard objectives add ir dummy` (idempotent) creates
the objective; sets the internal constants `#C12 = 12`, `#C100 = 100`,
`#C1000 = 1000`; calls `infinite_rail:config` to apply all tunables; prints a
"Loaded" message. Does **not** touch ride state (including `#autodone`), so a
`/reload` mid-ride refreshes the knobs without stopping it, and a stopped world
stays stopped.

**`function/config.mcfunction`**
The single file a user edits. Sets every tunable score (`#HOVER`, `#CAMHEIGHT`,
`#CAMSMOOTH`, `#AUTOSTART`, `#DEADBAND`, `#SAMEGAP`, `#TURNGAP`, `#UPCLAMP`,
`#DOWNCLAMP`, `#AHEAD`, `#GENAHEAD`, `#MAXTICK`) with heavily-commented
explanations. Called by `load`. Its header documents how to apply edits
(`/reload`) and that running `config` by itself only re-runs the in-memory copy
(so it's only good for resetting live `/scoreboard` tweaks).

### 6.3 Lifecycle / control

**`function/start.mcfunction`**
The player entry point. `execute as @p at @s align xz run function
infinite_rail:begin` — runs `begin` as the nearest player, positioned at that
player's block (X/Z floored to the grid, so the head marker lands block-aligned).

**`function/begin.mcfunction`**
Sets up and launches a ride (see the flow in §5). Notable steps:
- **Reset:** `#started=0`, `#autodone=1` (a ride has now been started in this
  world — the auto-starter must never fire again), kill any
  `ir_head`/`ir_probe`/`ir_cart`/`ir_seat`, `forceload remove all`, dismount
  the player — so `start` is safely re-runnable.
- **World tuning:** calls `setup_world`.
- **Anchor:** summons the two markers at the player (`~0.5 … ~0.5` = block
  center); force-loads a small area behind + the `#GENAHEAD` corridor ahead
  (via the `forceload` macro).
- **Initial elevation:** teleports `ir_probe` onto the surface here
  (`positioned over motion_blocking_no_leaves`), reads its Y into `#railY`, adds
  `#HOVER`, and writes that Y into the head marker via storage `tmp.y`.
- **Init counters:** `#slope=0`, `#flat=99` (large, so the first change isn't
  gap-blocked), `#lastDir=0`; seeds `#avg = #railY − #HOVER`; sets `#nextLoad`.
- **Track history:** empties storage `infinite_rail:track y`, sets
  `#trackBase = #headX` and records the first column's rail Y (index 0).
- **Pace cart:** places the first column (`place_flat`), summons `ir_cart`
  (invuln, small eastward motion) and `ir_plug`, and plugs the cart.
- **Pre-build:** sets `#budget = #CAMAHEAD + 32` and runs `build_loop` once
  synchronously — the head ends up past the rig's starting position, so the
  viewer starts on ready track.
- **Camera rig:** summons `ir_seat` (`teleport_duration:1`) and `ir_ride`
  (invuln, yaw 90) at the head, mounts the ride cart onto the seat and the
  player **into the ride cart** — the one and only player mount of the ride
  (mount events flash the client's un-hideable "press ⇧ to dismount" hint, so
  they must never repeat). Adventure mode + **infinite Resistance 255 +
  Saturation** (can't break track, get hurt, or starve); any leftover
  invisibility from older pack versions is cleared — the rider is meant to be
  visible in their cart.
- **Handoff:** seeds `#sy = #railY×1000`, runs `cam_follow` once to snap the
  rig to its cruising position, then `#started=1`.

**`function/setup_world.mcfunction`** / **`function/setup_world_26.mcfunction`**
One-time gamerule tuning for a clean ride: silences command feedback/output/
advancement spam; don't keep origin chunks loaded; no mob griefing (creepers/
endermen can't wreck the track); no fire spread, no phantoms; disabled tile drops; disabled all environmental damage; immediate respawn at the moving spawn point if anything impossible ever happens. It exists
**twice** because snapshot 25w44a (the 26.x era) renamed every gamerule to
snake_case (and reworked a few: `announceAdvancements` →
`show_advancement_messages`, `doInsomnia` → `spawn_phantoms`, `doFireTick` →
removed in favor of `fire_spread_radius_around_player`, `spawnChunkRadius` →
gone): a `.mcfunction` with an unknown gamerule fails to *compile* and is
silently dropped from the pack, so on any given version exactly one of the two
variants exists in memory. `begin` calls both; the missing one is a harmless
runtime no-op. Keep them in sync when changing a rule.

**`function/stop.mcfunction`**
Ends the ride: `#started=0`, clears effects from and dismounts adventure
players, kills `ir_cart`, `ir_ride`, `ir_seat`, `ir_plug` and both markers,
clears all forceloads.
`#autodone` stays `1`, so a stopped world never auto-restarts. **The built
track (blocks + `ir_disp` displays) is intentionally left in the world.**

**`function/tick.mcfunction`**
The heartbeat. If `#started == 1`, run `main`. Below that, the **auto-starter**:
while `#AUTOSTART == 1`, `#started == 0` and `#autodone ≠ 1`, it waits for a player to exist, then runs a 100-tick countdown before running start, at which point `begin` sets `#autodone = 1` and it never fires again (the score persists in the world save).

**`function/main.mcfunction`**
Per-tick driver while riding:
1. Sample the pace cart's X into `#cartX`.
2. **Purity keepers:** `execute on passengers` ejects anything riding the pace
   cart that isn't the plug (scooped-up mobs), and anything riding the ride
   cart that isn't a player.
3. **Rider keeper:** any adventure player not currently riding is re-mounted
   into the ride cart (handles sneak-dismounts / relog — the only times the
   vanilla dismount hint can reappear).
4. **Mount keepers:** unconditional `ride … mount` attempts put the plug on
   the pace cart and the ride cart on the seat; non-player passengers expose
   no vehicle NBT to query, so the attempt itself is the check (it fails
   silently while already seated).
5. **Stall keeper:** read `Motion[0]×100` into `#mx`; if `#mx ≤ 10` (speed
   < 0.1, i.e. stalled) `data merge` the pace cart's motion back to `0.5` east.
6. **Camera:** if the pace cart exists, run `cam_follow` (§7g).
7. Set `#budget = #MAXTICK` and run `build_loop` to extend the track.

### 6.4 The build loop

**`function/build_loop.mcfunction`**
Computes `#gap = #headX − #cartX`. If there is budget left **and** the head is
closer than `#AHEAD` blocks to the cart, runs `build_step`. This is the loop
condition; it builds no column itself.

**`function/build_step.mcfunction`**
`#budget −= 1`, `advance` (build exactly one column), then call `build_loop`
again. The `build_loop`⇄`build_step` recursion is a bounded loop: it keeps
building columns until either the head is `#AHEAD` ahead of the cart or the
per-tick `#budget` is exhausted. (Recursion depth is capped by `#MAXTICK`.)

**`function/advance.mcfunction`**
Builds **one** column (see §7 for the algorithms it drives):
1. Zero `#sum`, run `sample_window` at the head, compute `#avg = #sum / #C12`.
2. `#target = #avg + #HOVER`.
3. `decide` → sets `#dir` (−1/0/1).
4. Move the head and place the column, per `#dir`:
   - `#dir 0`: `tp head ~1 ~ ~`; `place_flat`.
   - `#dir -1`: `tp head ~1 ~-1 ~`; `place_down`; `#railY −= 1`.
   - `#dir 1`: `tp head ~1 ~ ~`; `place_up`; `tp head ~ ~1 ~`; `#railY += 1`.
5. `#headX += 1`.
6. Append the (updated) `#railY` to the track-history list (the camera's map
   of the path; index = `#headX − #trackBase`).
7. If `#headX ≥ #nextLoad`, run `roll_chunks`.

### 6.5 Terrain sampling & the slope decision (the algorithm)

**`function/sample_window.mcfunction`**
Runs positioned at the head. Computes the clamp window `#lo = #avg − #DOWNCLAMP`,
`#hi = #avg + #UPCLAMP` (using the previous column's `#avg`). Then, for each of
**12** offsets `~4, ~8, … ~48` blocks east: teleport `ir_probe` there and
`positioned over motion_blocking_no_leaves` (snaps it to the surface — ignores
tree leaves, includes water/lava surfaces so oceans read as sea level); read its
Y into `#s`; discard void/ungenerated reads (`#s ≤ −63 → #s = #avg`); clamp `#s`
to `[#lo, #hi]`; add to `#sum`. `advance` then divides `#sum` by `#C12` to get
the new `#avg`. **The clamp is what makes narrow ravines/spikes barely move the
average** (so they get bridged/tunneled level) while broad mountains still shift
it. *(This is the one function whose exact number of sample blocks is fixed —
`#C12` must equal the count here.)*

**`function/decide.mcfunction`**
Chooses this column's `#dir` using the **event model** (§7b). Computes `#diff =
#target − #railY` and snapshots `#slope0 = #slope`.
- If an event is in progress (`#slope0 = ±1`): keep sloping the same way until
  the rail reaches the target — climb while `#diff ≥ 1`, descend while `#diff ≤
  −1`; otherwise call `end_event` (the event is complete; this column is flat).
- If flat (`#slope0 = 0`): call `consider_start` to maybe begin a new event.

**`function/consider_start.mcfunction`**
Decides, when flat, whether to begin a climb/descent:
- `#want = 1` if `#diff ≥ #DEADBAND`; `#want = −1` if `#diff ≤ −#DEADBAND` (via
  `#ndead = −#DEADBAND`); else `0`.
- If `#want = 0`: stay flat, `#flat += 1` (count toward the next gap).
- If `#want ≠ 0`: pick `#need = #SAMEGAP` (if `#want == #lastDir`) or `#TURNGAP`
  (reversal). If `#flat ≥ #need`, call `start_event`; otherwise **hold level**
  (`#flat += 1`, guarded by `#slope == 0`). Holding is what produces bridges (the
  ground drops away under a level rail) and tunnels (the ground rises into it).

**`function/start_event.mcfunction`**
Begins an event: `#dir = #want`, `#slope = #want`, `#lastDir = #want`,
`#flat = 0`. This column becomes the first sloped column; `decide` continues the
slope on subsequent columns until the target is reached.

**`function/end_event.mcfunction`**
Ends an event: `#slope = 0`, `#flat = 0`. `#dir` stays `0`, so the current column
is placed flat at the elevation just reached, and gap-counting restarts.

### 6.6 Column geometry (how slopes map to blocks)

All three run positioned at the head; the head is already at this column's
`(X, railY, Z)`. **Order matters:** the carve happens first, then `support`
(which lays the redstone block *under* the rail), then the rail, then the light —
because the track hovers above the ground, so the cell under the rail is air and
the rail would pop off if placed before its support existed.

**`function/place_flat.mcfunction`**
`fill ~ ~ ~-1 ~ ~4 ~1 air` (carve 3 wide × 5 tall); `support`; `powered_rail
[shape=east_west,powered=true]` at `~`; `light[level=11]` at `~3`.

**`function/place_up.mcfunction`**
Climbing column. Same as flat but carves one taller (`~5`, extra headroom as the
cart rises) and places `powered_rail[shape=ascending_east,powered=true]`.

**`function/place_down.mcfunction`**
Descending column. Carves `~5` tall; places
`powered_rail[shape=ascending_west,powered=true]`. (Because a descent moves the
head down first, the rail sits one lower and slopes up toward the west behind it,
which is the same physical staircase as a climb viewed the other way.)

**`function/support.mcfunction`**
Lays the power+disguise under the rail (shared by all three place functions):
- `setblock ~ ~-1 ~ minecraft:redstone_block` — a block of redstone directly
  under the rail. It **powers the powered rail resting on it**, is **immune to
  water**, and **emits no light** (so it can't wash away or melt ice). This
  single block replaces the old 5-block stone/torch/stone stack + barriers.
- `execute align xyz run summon minecraft:block_display …` — a smooth-stone
  `block_display` (tag `ir_disp`) that disguises the red block. Details that
  matter:
  - `align xyz` snaps the summon to the block corner (the head is block-centered).
  - `brightness:{sky:15,block:15}` is **required** — a display samples the light
    of the cell it occupies, which contains the opaque redstone block (light 0),
    so without the override it renders solid black.
  - `scale:[1, 1.01, 1.01]` / `translation:[0, −0.005, −0.005]` — enlarged a hair
    in **Y and Z only** so the visible faces (underside + the two sides seen from
    a bridge) sit just outside the redstone block and don't z-fight it. X stays
    exactly 1 so neighboring supports (one block apart along the track) touch but
    never overlap — a uniform >1 scale made adjacent displays overlap and shimmer.

### 6.7 Chunk management

**`function/roll_chunks.mcfunction`**
Runs every 16 blocks of head travel (gated by `#nextLoad` in `advance`),
positioned at the head. Stores `#GENAHEAD` into `infinite_rail:args gen` and
calls the `forceload` macro (generate ahead, release behind). Then
`setworldspawn` and `spawnpoint @a` at `~ ~1 ~` so world spawn and the player's
respawn point **roll forward with the ride** (nothing anchors to the origin);
`#nextLoad += 16`.

**`function/forceload.mcfunction`** *(a function macro)*
`forceload` only accepts literal/relative coordinates, not scoreboard values, so
the configurable distance arrives as the macro arg `$(gen)`:
- `$forceload add ~ ~-8 ~$(gen) ~8` — force-generate the corridor from the head
  out to `#GENAHEAD` blocks ahead (±1 chunk in Z).
- `forceload remove ~-336 ~-8 ~-256 ~8` — release a band well behind the head;
  as the head advances 16 at a time these bands tile to clear everything ≳256
  blocks back. Runs at the caller's position (head), inherited via the call.

### 6.8 Smooth camera (the ride rig)

**`function/cam_follow.mcfunction`**
The per-tick camera driver, called from `main` (gated on `ir_cart` existing;
returns immediately if there is no track history, e.g. the pack was updated
over a ride in progress). Reads the pace cart's X once as fixed-point
(`#cxm = X×1000`) and derives both the sub-block fraction `#fx` (floorMod)
and the rig's column index `#ci` (cart column + `#CAMAHEAD`, clamped to the
valid history range) from it; precomputes `#lift`/`#wmax`/`#half`; reads the
rail line at the rig (`#linem`, one `cam_sample`); computes the two candidate
heights — `#c1`, the constructed S-curve (blend loop `cam_blend`), and
`#s2 += (#linem − #s2)/#CAMSMOOTH`, the reactive descent chaser — and takes
`#sy = max(#c1, #s2)`, floored at `#linem`; then `cam_move`. See §7g.

**`function/cam_blend.mcfunction`** *(recursive)*
One S-curve sample per call: offset `#j` runs from −`#CAMBLEND/2` to
+`#CAMBLEND/2` in steps of 1. Each sample computes
`lifted(j) = min(max of the profile over [j .. j+#wmax+1], line(j) + #lift)`
via `cam_scan`, and accumulates `#tsum`/`#tn`; `#c1` is their average — an
average over a symmetric window reproduces straight stretches exactly and
turns every corner of `lifted()` into a parabolic blend `#CAMBLEND` long.

**`function/cam_scan.mcfunction`** *(recursive)*
The small forward-max scan for one blend sample: `#k` runs 0 to `#wmax` in
steps of 1, tracking the highest interpolated height `#fmx` and capturing the
k = 0 sample as `#l0`. Scanning further than `#CAMLIFT`+2 blocks is pointless
(the `+#lift` cap clips anything higher), which is also what keeps lift-off
from starting any earlier than the blend needs.

**`function/cam_sample.mcfunction`**
Reads one interpolated profile height into `#sm`: column `#si` (clamped to
the built range) and its neighbor, blended by `#fx`/`#fi` so values move
continuously as the cart crosses block edges.

**`function/cam_get.mcfunction`** *(a function macro)*
`$execute store result score #ly ir run data get storage infinite_rail:track y[$(i)]`
— NBT paths only take literal indices, so the index arrives as a macro arg
(storage `infinite_rail:cami i`).

**`function/cam_move.mcfunction`**
Teleports the seat — and with it the rigid ride-cart + rider stack — to
`#CAMAHEAD` blocks east of the pace cart at height
`#sy + 62 + #CAMHEIGHT×100` milli (62 ≈ how high a minecart rests above a
rail, so the ride cart sits on the smoothed line like a real cart). Runs
`cam_tp` **positioned at the pace cart**, so X/Z are relative offsets and
never pass through a scoreboard (full double precision forever).

**`function/cam_tp.mcfunction`** *(a function macro)*
One line: `$tp @e[type=item_display,tag=ir_seat,limit=1] ~$(dx) $(y) ~` —
relative X (the `#CAMAHEAD` offset) and Z with an absolute Y. `tp` only takes
literal/relative coordinates, so the values arrive as macro arguments from
storage `infinite_rail:cam`.

---

## 7. The algorithms in depth

### 7a. Heightmap sampling → rolling average
Per column, `sample_window` reads the surface Y at 12 points spread over the next
48 blocks and averages them into `#avg`. Two safeguards: void/ungenerated reads
(`≤ −63`) are replaced by the previous average, and each sample is **clamped to
`±#DOWNCLAMP / +#UPCLAMP` around the previous average**. The clamp is the
"smoothing" dial: small values make the line ignore sudden dips/spikes (they get
bridged/tunneled level); large values make it hug the terrain closely.

### 7b. The event model (slope shaping)
The target elevation is `#avg + #HOVER`. Rather than nudging one block at a time,
the rail moves in **events**: once it decides to climb or descend, it does so as
a single unbroken 45° run (`#slope` persists; `decide` keeps `#dir` nonzero)
until `#railY` reaches the target — never "up, flat, up, flat." Between events
the rail is flat, and two spacing gaps govern when a new event may start:
`#SAMEGAP` (repeat the same direction) and `#TURNGAP` (reverse). `#DEADBAND` adds
hysteresis so terrain noise below that height difference is ignored. When a
change is *wanted* but a gap forbids it, the rail **holds level** — which is
exactly what turns into a **bridge** (ground falls away) or a **tunnel** (ground
rises into the carve). So bridges and tunnels are not special cases; they emerge
from "hold the line until the gap allows a change."

### 7c. Column geometry (how slopes map to blocks)
`advance` moves the head and picks the place function by `#dir`:
- **Flat:** head east +1; rail at `railY`.
- **Climb:** head east +1; place `ascending_east` at the *current* `railY`; then
  head up +1 and `#railY += 1`. So each climbing column's rail is one higher than
  the last — a staircase of ascending rails a minecart takes as a smooth 45° line.
- **Descend:** head east +1 **and down −1**; place `ascending_west` at the new
  (lower) `railY`; `#railY −= 1`.
Each column then carves clearance above, lays the redstone support below, sets
the rail, and adds the light (§6.6).

### 7d. Power & the disguise
Every rail is `powered=true` and sits directly on a **block of redstone**, which
powers it (a rail resting on a redstone power source is activated) with no torch,
no support stack, and no barriers. Because a raw redstone block would show red
from the side of a bridge, each one is covered by a smooth-stone `block_display`
(`ir_disp`). The display needs a `brightness` override (it sits inside an opaque
block → samples light 0 → would be black) and a Y/Z-only oversize (to cover its
visible faces without overlapping neighbors). Cost per column: **1 block + 1
display + 1 rail** (down from 5 blocks + 1 rail in the old torch design).

### 7e. Chunk loading / unloading
`forceload` generates a corridor `#GENAHEAD` blocks ahead of the head so the
heightmap scanner always has real terrain, and releases chunks a few hundred
blocks behind. There are **two independent look-ahead distances**: `#AHEAD` (how
far ahead of the *cart* the rails are laid) and `#GENAHEAD` (how far ahead of the
*rail head* the world is generated) — so terrain exists ≈ `#AHEAD + #GENAHEAD`
ahead of the cart. Memory stays flat (passed chunks unload), though vanilla
commands can't delete chunks from disk, so the world folder still grows slowly.

### 7f. The keepers
Per-tick guards in `main` make the ride truly unbreakable: anything riding the
pace cart that isn't the plug is ejected, as is anything riding the ride cart
that isn't a player; a dismounted rider is re-mounted into the ride cart; the
plug and the ride cart are re-mounted onto their perches (unconditional
attempts that fail silently while already seated); and if the pace cart's
eastward speed ever drops near zero it's re-boosted to `0.5`. The ride cart's pitch is locked horizontally, and the player's inventory is cleared every tick. Combined with
the always-powered rails, the ride can never stop — and because both carts
always carry a passenger, neither can be entered by right-click or scoop up
passing mobs.

### 7g. The smooth camera (the ride rig)
Java has no `/camera` command (that's Bedrock-only), so the pack uses the
vanilla-Java equivalent — a riding stack teleported along a smoothed path.
The design has three pillars:

1. **One rigid rig, one mount, zero transitions.** The player sits in a real
   minecart (`ir_ride`) that is itself a permanent passenger of the
   interpolated camera seat (`ir_seat`). Clients position passengers from
   their vehicle every frame, so seat → ride cart → player move as a single
   rigid body: the cart the player sees can never bounce, tilt or shift
   against their view, and eye height is genuine minecart-passenger parity by
   construction — no calibration, no mount swaps. The player mounts exactly
   once per ride; this matters because every player mount event flashes the
   client's "press ⇧ to dismount" hint, which cannot be suppressed
   server-side. (Vehicle-swap designs also physically move the player,
   because passenger attachment offsets differ between entity types — the
   rig sidesteps both problems.)
2. **A constructed S-curve, not a chase.** The pack *built* the track, so it
   knows the exact elevation profile — `advance` records every column's rail
   Y into a storage list. From it the camera height is **constructed
   statelessly each tick** as the higher of two candidate curves:
   - `c1`, the S-curve: take `lifted(x) = min(max of the profile over the
     next ~#CAMLIFT+2 blocks, railY + #CAMLIFT)` — the rail line raised by
     `#CAMLIFT` wherever the track climbs, rising just before climb corners
     and flattening at the summit level `#CAMLIFT` early — then **average it
     over a symmetric ±`#CAMBLEND/2` window**. The average reproduces
     straight stretches *exactly* (level on flats, truly parallel at 45°
     mid-climb — no lag, no exponential tail) and turns every corner into a
     parabolic blend exactly `#CAMBLEND` blocks long. Result: the camera
     lifts off ~`#CAMBLEND/2 + #CAMLIFT + 2` blocks before a climb, is
     already moving parallel when the slope arrives, rides it precisely, then
     decelerates and lands **level, exactly at the summit height** — no
     45°-pin, no kink. The blend never stretches across a whole slope, so
     smoothing can't accumulate into tunnel-roof collisions.
   - `c2`, the descent chaser: the classic reactive ease toward the rail line
     by `1/#CAMSMOOTH` per tick — it floats above the line as the track drops
     away and settles into valleys (on descents `lifted()` hugs the line, so
     `c2` wins the max; on climbs it lags below and is ignored).
   A final floor at the rail line means the rig can never sink into the track.
3. **A hidden cart sets the pace.** The rig rides `#CAMAHEAD` blocks east of
   the pace cart (`ir_cart`), which rolls along the physical rails behind the
   viewer, out of forward view. Whatever speed the rails push it — including
   a changed `max_minecart_speed` gamerule under the `minecart_improvements`
   experiment — the rig inherits automatically; there is no hard-coded
   velocity anywhere.

Because riding only carries *position* (never view), the player keeps full
free-look — better than Bedrock's `/camera`, which locks the view. The rider
is visible, sitting in their gliding cart like on any minecart ride. (The
ride cart, being off-rail, doesn't pitch on slopes — it glides level through
the smoothed climbs, which reads naturally with the eased motion.)

---

## 8. Tuning

All knobs live in `config.mcfunction` (see the table in §4.1). **To apply edits:
change the value, then run `/reload`** (or rejoin the world) — the game re-reads
the file and re-runs `config`, updating a ride already in progress. To experiment
without editing the file, set a score live, e.g. `/scoreboard players set #HOVER
ir 8` (takes effect on the next column; wiped on the next `/reload`/rejoin).
Running `/function infinite_rail:config` by itself does **not** pick up file
edits — it re-runs the copy already in memory.

Current defaults in `config.mcfunction`: `#HOVER 2`, `#CAMHEIGHT 0`,
`#CAMBLEND 6`, `#CAMSMOOTH 8`, `#CAMLIFT 24`, `#CAMAHEAD 64`, `#AUTOSTART 1`,
`#DEADBAND 2`, `#SAMEGAP 25`, `#TURNGAP 40`, `#UPCLAMP 75`, `#DOWNCLAMP 25`,
`#AHEAD 224`, `#GENAHEAD 192`, `#MAXTICK 15`. (These are tuned to taste and change often;
the algorithm works across a wide range. The gaps and deadband are far lower
than the pre-camera 50/50/4 because the profile-driven camera erases slope
corners entirely, so frequent small elevation changes are now visually free.
`#AHEAD` includes the `#CAMAHEAD` offset — the viewer sees roughly
`#AHEAD − #CAMAHEAD` blocks of ready track ahead.)

---

## 9. Limitations & gotchas

- **Disk usage grows.** Commands can unload chunks (memory stays flat) but can't
  delete them from disk, so a very long ride slowly grows the world folder.
- **Single rider.** One cart, one occupant; designed for a solo viewer.
- **Overworld only.** The Nether's bedrock ceiling confuses surface heightmaps.
- **Very low `#HOVER`.** The redstone support is immune to water, but the *rail*
  is not — at `#HOVER 0` or below, the rail itself can sit in water and wash out.
  Keep the track hovering above sea level. (The power source is safe regardless.)
- **Pack-ice tunnels.** The `light[level=11]` block is exactly at the ice-melt
  threshold, so it doesn't melt ice; the redstone block emits no light. So the
  power stays safe, but a `light` level raised above 11 could melt ice into the
  bore.
- **Display entities accumulate** in the built (and saved) chunks like any block;
  they unload behind the ride with their chunks. `brightness:{sky:15,block:15}`
  is full-bright, so the disguised stone won't dim at night — lower `block`
  toward 0 in `support.mcfunction` if that reads as too bright.
- **Track history grows.** The camera's profile list gains one int (~4 bytes)
  per column for the life of a ride — a few MB after a multi-day ride. It's
  reset on every fresh `start`.
- **Sub-block camera math degrades past X ≈ ±2,147,000.** The cart's X×1000
  fraction read overflows a scoreboard int out there (~3 days of continuous
  riding); the camera would get a garbage sub-block fraction (≤1 block of
  jitter, track itself unaffected). Everything else uses NBT doubles.
- **Updating the pack over a ride in progress** leaves the camera idle (no
  track history exists for the already-built line). Run `start` again to
  begin a ride with the full system.
- **The pace cart is visible looking backward** — an empty-looking minecart
  rolling `#CAMAHEAD` blocks behind the viewer. Raise `#CAMAHEAD` to push it
  further out of sight (keep `#AHEAD` at least ~40 above it, and `#AHEAD`
  below ~250 so the rolling forceload never releases the pace cart's chunk).
- **The vanilla dismount hint** ("press ⇧/left-ctrl to dismount") is a
  client-side toast shown on every player mount event; it cannot be hidden by
  a server or data pack. The rig design means it appears exactly once, at
  ride start (and again only if the rider dismounts themselves and is
  re-caught by the keeper).
- **Auto-start on upgraded worlds.** `#autodone` didn't exist before the
  smooth-camera update, so a pre-existing world that had used the pack will
  auto-start once on its first load after upgrading (its `#autodone` is unset).
  Run `stop` once, or set `#AUTOSTART 0`, if that's unwanted.
- **File edits need `/reload`.** See §8 — the single most common point of
  confusion.

---

## 10. Quick map (function → what calls it)

```
#minecraft:load ─ load ─ config
#minecraft:tick ─ tick ─┬─ main ─ build_loop ⇄ build_step ─ advance ─┬─ sample_window
                        │         │                                  ├─ decide ─ consider_start ─ start_event
                        │         │                                  │                 └─ (decide also calls) end_event
                        │         ├─ (keepers, inline)               ├─ place_flat / place_up / place_down ─ support
                        │         ├─ #cartX read                     ├─ (track-history append)
                        │         │                                  └─ roll_chunks ─ forceload (macro)
                        │         └─ cam_follow ─┬─ cam_blend ⇄ cam_scan ⇄ cam_sample ─ cam_get (macro)
                        │                        └─ cam_move ─ cam_tp (macro)
                        └─ (auto-start, once per world) start

/function infinite_rail:start ─ start ─ begin ─┬─ setup_world / setup_world_26 (one compiles per version)
                                               ├─ forceload (macro)
                                               ├─ (track-history reset)
                                               ├─ place_flat (first column) ─ summon ir_cart + ir_plug
                                               ├─ build_loop … (pre-build past the rig position)
                                               ├─ summon ir_seat + ir_ride, mount the stack
                                               └─ cam_follow (snap the rig into place)
/function infinite_rail:stop  ─ stop
```
