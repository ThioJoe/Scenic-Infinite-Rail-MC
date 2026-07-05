# CONTEXT.md — How the Infinite Rail pack works

A complete technical reference for the project: the architecture, the shared state, every file, and the algorithms. Written for a developer (or an AI) who needs to understand or modify the pack. For the repository layout and build workflow see `BUILDING.md`.

Sections 1–10 document the **Java Edition** data pack (the original and richest implementation); **section 11** documents the **Bedrock Edition** port and how the two editions share one codebase.

---

## 1. What it is

A **100% vanilla Minecraft: Java Edition data pack** (no mods, no resource pack) that turns the game into an endless, relaxing "Slow TV" minecart ride. Inspired by "Slow TV" train journey videos, the player glides over plains, bridges ravines and oceans, and tunnels through mountains, forever. (A Bedrock behavior-pack port built from the same sources is covered in §11.)

The ride starts by itself in a fresh world (or via one command): the player is placed on a self-building, permanently-powered rail line heading **due east forever**, while an algorithm lays smooth track over the procedurally generated terrain — bridging valleys and oceans, tunneling through mountains, and hovering a few blocks above the ground the rest of the time. The player sits in a real minecart — but not the one on the rails: their cart is glued to an invisible, interpolated **camera seat** that flies a pre-smoothed S-curve computed from the track's own recorded profile, while a hidden **pace cart** rides the physical rails behind them and sets the speed. Slope corners and rail physics never reach the player's eyes, and they mount exactly once per ride (§7g).

Everything is driven by `.mcfunction` files and a single scoreboard. There is no Java, no external process. Target versions: **Java 1.21 through 26.2** (see `pack.mcmeta`).

Key design facts to keep in mind while reading:

- **The world is one-dimensional in travel.** The cart only ever moves in **+X (east)**. Z is fixed (the track never turns). Y is what the algorithm decides.
- **The "column"** is the unit of work: one X-slice of track (a rail, its support below, a light above, and carved air around). The pack builds columns one at a time, ahead of the cart.
- **All shared state lives in one scoreboard objective, `ir`.** Values are held on fake players whose names start with `.` (a convention for "not a real player / internal variable" — chosen over Java's traditional `#` because `.` parses on Bedrock's command engine too, keeping the shared files byte-identical across editions). There are no data structures beyond that and a little command storage. (One Java-only exception: `ir_menu`, a `trigger`-criteria objective that exists purely as the Settings book's permission-free click channel — §6.9.)

---

## 2. Data pack anatomy & how Minecraft bootstraps it

The **shipped** Java pack (what `tools/build.mjs` assembles into `dist/java/infinite_rail/`) looks like this:

```
infinite_rail/
  pack.mcmeta                                   # pack metadata + version compat + overlays
  data/
    minecraft/tags/function/
      load.json                                 # vanilla hook: run on load/reload
      tick.json                                 # vanilla hook: run every tick
    minecraft/function/
      ir_*.mcfunction                           # one-line call bridges for the shared
                                                # brain files (bare-name -> namespaced)
    infinite_rail/function/
      *.mcfunction                              # all the logic (namespace: infinite_rail)
  overlay_snake/                                # version overlay: replaces files on format 92+
    data/infinite_rail/function/
      setup_world.mcfunction                    # snake_case gamerules (26.x)
      names.mcfunction                          # snake_case command/gamerule names (26.x)
```

**In the repository**, these files are split across `src/java/` and `src/shared/functions/`: six functions (`config`, `modes_init`, `decide`, `consider_start`, `start_event`, `end_event`) are *shared source* used **byte-identically** by both the Java pack and the Bedrock port, and the build drops them into `data/infinite_rail/function/` alongside the Java-only files (see `BUILDING.md` and §11). The `data/minecraft/function/ir_*` files are the Java half of the shared files' call bridges (§11a). Nothing about the shipped pack differs from the layout above.

**Version overlay.** `pack.mcmeta` declares an *overlay* (`overlay_snake`) that applies on data-pack **format 92+** (25w44a onward, the 26.x "snake_case gamerule" era). Files inside it transparently **replace** the same-path files in `data/` on those versions, so the base pack carries the camelCase (format 82-91) copies and the overlay carries the snake_case ones. The shared logic just calls `setup_world` / `names` once and always gets the version-correct copy — no runtime branching, no compile-drop, no duplicate calls. (Overlay format numbers: 92 = 25w44a's rename; 107 = 26.2 — bump the overlay `max_format` alongside the pack's when extending support.)

Minecraft discovers a data pack by its `pack.mcmeta`. Two **vanilla function tags** are the only entry points the game calls on its own:

- `#minecraft:load` → lists `infinite_rail:load`. The game runs it **once when the world loads and again on every `/reload`.** This is where the pack initializes.
- `#minecraft:tick` → lists `infinite_rail:tick`. The game runs it **every game tick (20×/second).** This is the pack's heartbeat.

Everything else is a normal function reached by `function infinite_rail:<name>` calls, or by the player running `/function infinite_rail:start` / `:stop`.

> **Important behavior:** the game loads every `.mcfunction` into memory at load/`/reload` time. Editing a file on disk does **not** change the running game until `/reload` (or a world rejoin). This is why `config` is applied via `/reload`, not by re-running the `config` function (see §6).

---

## 3. Coordinate & geometry conventions

- **+X = east = the direction of travel.** The head advances in +X.
- **Z is constant** — the centerline of the track. It never changes after start.
- **Y** is the elevation the algorithm chooses per column.
- **The head marker** (`ir_head`, §4) sits at the current build position: `(headX + 0.5, railY, centerZ + 0.5)` — block-centered in X/Z, integer Y. Most build commands `execute ... at @e[ir_head]` and then use `~` relative coordinates, so in the place/support/sample functions:
  - `~` = the rail's cell (Y = railY)
  - `~-1` = one below the rail (the support / redstone block)
  - `~3` = three above the rail (the light block)
  - `~4` / `~5` = top of the carved clearance
  - `~-8 .. ~8` in Z (forceload) = ±1 chunk around the centerline (widened
    up to `.TORCHRANGE` while torch mode is on — see `forceload_here`)

A single **column** therefore looks like this vertically (flat case):

```
  railY+4 .. railY+1   air (carved clearance / tunnel bore)
  railY+3              minecraft:light[level=11]   (lights tunnels, blocks mob spawns)
  railY                minecraft:powered_rail (always powered)
  railY-1              minecraft:redstone_block   (powers the rail; disguised as smooth_stone by a block_display)
```

Consecutive columns differ in X by 1. On slopes they also differ in Y by 1, producing a 45° "corner-to-corner" line of ascending rails (see §7c).

The carve is **vegetation-sparing** (§7i): only the rail cell and the cell above it (center) are cleared unconditionally; the side cells and the center cells ≥ 2 above the rail leave natural vegetation standing (terrain always carves). Slope columns and the `.SLOPECLEAR` columns around them clear their full center bore regardless.

---

## 4. Shared state

### 4.1 The `ir` scoreboard objective

A single `dummy` objective named `ir` holds every variable. All are on `.`-named fake players (both editions, same spelling). Grouped by role:

**Tunable config knobs** (set by `config.mcfunction`; see §8):

| Score        | Meaning |
| ------------ | ------- |
| `.HOVER`     | Preferred rail clearance (blocks) above the average terrain surface. |
| `.TUNNEL`    | Clearance bore height (blocks above the rail) carved per column; the tunnel/headroom height. Slope columns carve `.TUNNELUP` (= `.TUNNEL+1`). Keep ≥ 3 (the light sits at rail+3). |
| `.MAXSPEED`  | Default value pushed into the minecart max-speed gamerule at ride start (blocks/s). Applied once, not enforced. Needs the Minecart Improvements feature to have any effect. |
| `.OCEANSPEED`| Minecart max-speed used while crossing open ocean. `0` disables the ocean speed-up entirely. |
| `.OCEANCHUNKS`| Consecutive ocean-biome chunks the ride must cross before speeding up to `.OCEANSPEED`. |
| `.LANDCHUNKS`| Consecutive non-ocean chunks after a speed-up before reverting to `.MAXSPEED`. |
| `.SKYY`      | Sky mode's fixed cruising altitude: while `.SKYMODE` is 1 the shared `decide` steers the rail to exactly this Y (§6.9). Raise it toward ~260 to clear even the tallest jagged peaks. |
| `.SKYSPEED`  | Sky mode's cruising speed (blocks/s), applied while the mode owns the speed system. |
| `.TORCHODDS` | Torch mode: percent chance (0-100) per new column of planting a torch beside the line (e.g. 10 = on average about one torch per 10 blocks of line). |
| `.TORCHRANGE`| Torch mode: the farthest a torch may land from the centerline — each torch rolls uniform 2..this (clamped 2-48). Above 8, `forceload_here` widens the Java corridor so the whole band stays loaded. |
| `.DEBUGMODE` | `1` = print chat messages about the speed system (default applied, each ocean/land chunk with counters + the cart's real speed, every speed change); `0` = silent. |
| `.CAMHEIGHT` | **Extra** rig height above the rail line, in **tenths of a block** (0 = the ride cart rests on the smoothed line like a cart on a rail). Keep it small (<= ~5) so climb corners can't lift your head into tunnel roofs. |
| `.CAMBLEND`  | S-curve blend length in blocks (even): the camera transitions level⇄parallel over exactly this distance at every slope change. |
| `.CAMSMOOTH` | Descent glide divisor: the camera closes `1/.CAMSMOOTH` of a **downward** gap per tick (climbs use the constructed S-curve instead; 1 = off). |
| `.CAMLIFT`   | Climb float / crest budget, in **tenths of a block**: how high the camera rides above the rail line while climbing, and how early it reaches the summit level. |
| `.CAMAHEAD`  | How many blocks the rig (viewer) rides ahead of the hidden pace cart. Keep ≥ ~40 below `.AHEAD`. |
| `.CAMMODE`   | **Bedrock-only** (inert on Java): `0` = native free-look rig, `1` = eased cinematic camera via Bedrock's camera system (§11). |
| `.CARTYOFF`  | **Bedrock-only** (inert on Java): fine-tune for the minecart visual's height, in tenths of a block (negative = lower). The base correction is baked into the pack's re-based model copy (`geometry.ir_cart`, 16px down -- vanilla's cart geometry draws a block high outside the engine's internal renderer), so keep this small: a large negative offset sinks the cart *entity* into the track blocks, where it suffocates. Live-tunable mid-ride. |
| `.HIDEHAND`  | **Bedrock-only** (inert on Java): `1` = hide the rider's first-person arm automatically (the "Hide Hand" video setting's job). `/hud` has no hand element, so this is done with an invisibility effect on the rider, re-asserted once a second by the keeper — the rider's body is hidden in third-person/F5 too. `0` = leave the arm visible. |
| `.AUTOSTART` | `1` = the ride auto-starts for the first player in a fresh world; `0` = manual start only. |
| `.DEADBAND`  | Minimum `|target − railY|` before a slope change is even considered (hysteresis vs. terrain noise). |
| `.SAMEGAP`   | Minimum flat columns between two elevation changes **in the same direction**. |
| `.TURNGAP`   | Minimum flat columns before the rail may **reverse** direction. |
| `.SLOPECLEAR`| How many columns just **before and after** every slope get their full-height center clear even through vegetation (§7i) — the camera floats above the rail line around slopes. Vertical only; the cells left/right of the track always spare plants. Keep ≥ the camera's lift-off run (~`.CAMBLEND/2 + .CAMLIFT/10 + 2`) and ≤ `.SAMEGAP`. 0 = only the slope columns themselves. |
| `.UPCLAMP`   | Max a single heightmap sample may pull the rolling average **up** per column. Larger values make approaching mountains raise the target sooner (earlier, gentler climbs). |
| `.DOWNCLAMP` | Max a single heightmap sample may pull the rolling average **down** per column. Smaller values mean ravines and canyons are ignored and bridged dead level instead of dipped into. |
| `.UPLOOK`    | Climb-side ground scan reach (blocks ahead of the head — §7j): the contact detector (a climb may start inside the deadband when the level line would physically hit ground in this range), the crest-completion reach, and the reach of the climb **schedule** (see `.UPEARLY`) — so it also bounds the tallest wall crestable without tunneling. Effective max 48 (the scan's cap). `0` = climb timing is ruled by the average alone. |
| `.UPGRACE`   | How many blocks **above** the average-derived `.target` a climb may overshoot to clear ground the `.UPLOOK` scan still sees near the rail line (crest completion — wide hilltops are ridden over at hover height instead of tunneled just under the summit; narrow ridges above this budget still get punched). `0` = climbs stop exactly at the target. |
| `.UPEARLY`   | The climb schedule's slack (blocks): how much sooner than *strictly necessary* a climb may begin. The scan projects every surface ahead onto a 45° line; a climb is held until the rail is within this many blocks of the projected height (§7j). `0` = ramps start at the last possible column and top out right at the crest; bigger = earlier, longer ramps that finish about this early; ~50+ = no schedule (the old ramp-up-way-early behavior). |
| `.DOWNLOOK`  | Descent-side ground scan reach (blocks — §7j): a down-step is only taken when the rail stays above the **tallest** surface in this range (+`.DOWNGRACE`), so descents can never trench — a blocked descent ends just above the ground and continues, `.SAMEGAP`-paced, once it falls away. Also the clear-runway requirement: dips *narrower* than this are crossed level (bridged) instead of dipped into. Bigger = a calmer line that only descends into wider openings; smaller = hugs every hollow. `0` = descent timing is ruled by the average alone. |
| `.DOWNGRACE` | Clearance a descending step keeps above that tallest scanned surface. `0` = a descent may touch down exactly onto the highest nearby ground; higher = stops descents sooner / flies higher over crossed terrain. Keep it `< .HOVER`, or descents end just short of their target even over flat ground and the line rides permanently high. |
| `.AHEAD`     | How far (blocks) ahead of the **cart** the rails are kept built (Java: keep < ~250; Bedrock: useful up to ~270, the single-scout ceiling). |
| `.GENAHEAD`  | **Java only**; how far (blocks) ahead of the **rail head** terrain is force-generated (keep >= ~64). |
| `.MAXTICK`   | Max columns built per game tick (catch-up budget). |

**Mode toggles** (state, not config: flipped by the `mode_*` functions — §6.9 — seeded to 0 by the shared `modes_init` with add-0, and deliberately NOT reset by `config`/`/reload`; like every `ir` score they persist in the world save):

| Score        | Meaning |
| ------------ | ------- |
| `.RAINMODE`  | 1 = permanent rain is on. Informational once set — the weather-cycle gamerule and `/weather` do the actual work. |
| `.NIGHTMODE` | 1 = endless midnight is on. Informational once set — the daylight-cycle gamerule and `/time` do the actual work. |
| `.TORCHMODE` | 1 = torch scatter: each edition's builder plants torches beside new columns (Java `place_torch`/`torch_try`, Bedrock `maybeTorch()`). |
| `.SKYMODE`   | 1 = sky cruise: the shared `decide` overrides `.target` with `.SKYY`, and the editions pin the speed to `.SKYSPEED` while pausing the ocean system. |

**Internal constants** (set by `load.mcfunction`, kept out of user config):

| Score   | Meaning |
| ------- | ------- |
| `.C12`  | Number of heightmap samples per column (**12**) — the divisor for the average. Fixed by `sample_window.mcfunction`; changing one without the other breaks the average. |
| `.C2`,`.C10` | Small divisors for the camera scan geometry (`.CAMBLEND/2`, `.CAMLIFT` tenths→blocks). |
| `.C16`  | Blocks per chunk (**16**) — the divisor for the ocean-biome chunk counter. |
| `.C100` | Fixed-point multiplier **100**: converts `.CAMHEIGHT`/`.CAMLIFT` (tenths of a block) to milliblocks. |
| `.C1000`| Fixed-point multiplier **1000**: converts whole blocks to milliblocks / extracts the cart's sub-block X fraction. |
| `.TUNNELUP` | Derived in `load` after `config`: `.TUNNEL + 1`, the carve height for slope columns (extra headroom). Recomputed on every `/reload`. |

**Runtime state:**

| Score       | Meaning |
| ----------- | ------- |
| `.started`  | `1` while a ride is active. `tick` does nothing unless this is 1. |
| `.railY`    | Current rail elevation (Y). Tracks the head marker's Y. |
| `.headX`    | Current head X (also the column counter / absolute world X of the build front). |
| `.cartX`    | The cart's current X, sampled each tick, for the build-ahead gap. |
| `.gap`      | `.headX − .cartX` — how far the build front leads the cart. |
| `.budget`   | Columns left to build this tick (starts at `.MAXTICK`, counts down). |
| `.nextLoad` | The `.headX` value at which `roll_chunks` next fires (every 16 blocks). |
| `.avg`      | Rolling average of the terrain surface from the lookahead scan. |
| `.sum`      | Accumulator for the 12 samples in `sample_window`. |
| `.s`        | One sample's Y (temporary, reused per sample). |
| `.lo`,`.hi` | Per-column clamp bounds `.avg−.DOWNCLAMP` / `.avg+.UPCLAMP`. |
| `.target`   | Desired rail Y this column = `.avg + .HOVER`. |
| `.diff`     | `.target − .railY` (how far the rail is from where it wants to be). |
| `.gfloor`,`.gmax`,`.gcone` | The near-ground scan's outputs (§7j), set natively per column before `decide` from probe **pairs** (min of two consecutive probes — tree trunks are invisible): the highest pair within `.DOWNLOOK` (governs descents), the highest pair within `.UPLOOK` (climb contact/crest), and the climb schedule (highest 45°-projection `pair − distance` over pairs above `.railY − .HOVER`). Sentinels: `−10000` = no data for the maxes (guards fail open) or nothing-to-climb for `.gcone` (the schedule gate holds); `+32000` = no-data `.gcone` (the gate never holds). |
| `.dig`,`.dig2` | Computed by `decide` from `.gfloor`: one more down-step (resp. **two**) would land the rail below the descent floor (`.gfloor + .DOWNGRACE`). `.dig` **ends** a descent in progress (it rests just above the ground); `.dig2` vetoes a descent start. |
| `.push`     | Computed by `decide` from `.gmax`: the rail is not yet a full `.HOVER` above the highest ground within `.UPLOOK`, and may still overshoot (`.railY < .target + .UPGRACE`) — a climb in progress keeps climbing. |
| `.due`      | Computed by `decide` from `.gcone`: 1 = the climb schedule allows starting (the rail is within `.UPEARLY` of the cone's demanded height, or there is no data); 0 = `consider_start` holds every wanted climb. |
| `.glim`,`.glift`,`.gtop`,`.cgate`,`.rnext` | Guard scratch in `decide`: the descent floor, the overshoot ceiling, the crest-hover ceiling, the schedule gate height, and the candidate next rail Y. |
| `.nw`,`.nk`,`.sprev`,`.pmin`,`.prj`,`.gbase`,`.gnu` | Java `near_scan`/`near_step` state: the scan reach (`max(.UPLOOK, .DOWNLOOK)`, capped 48), the walking offset, the previous probe (pairing), the pair min, the 45°-projection scratch, the in-the-way threshold (`.railY − .HOVER`), and the valid-probe count (0 → `.gcone` fail-open). |
| `.ndead`    | `−.DEADBAND` (temp, the negative threshold for descending). |
| `.slope`    | Direction of the **event in progress**: `-1` descending, `0` flat, `1` climbing. Persists across columns. |
| `.slope0`   | Snapshot of `.slope` taken at the top of `decide` (so mid-function mutations don't confuse the branch logic). |
| `.dir`      | **This column's** move: `-1` down, `0` flat, `1` up. Read by `advance` to place the column. |
| `.want`     | Desired direction when flat (before the spacing gaps get a say). |
| `.need`     | The gap required for the wanted change this column (`.SAMEGAP` or `.TURNGAP`). |
| `.flat`     | Flat columns counted since the last event ended (compared against `.need`). |
| `.lastDir`  | Direction of the last event (`1`/`-1`), used to pick `.SAMEGAP` vs `.TURNGAP`. |
| `.mx`       | The cart's `Motion[0]` × 100 (its eastward speed, for the stall check). |
| `.rigX`     | The rider/seat's X (`ir_seat` Pos[0], integer), read each tick by `ocean_check` for the chunk math. |
| `.chunkNow` | The rider's current chunk index (`.rigX / 16`), recomputed each tick by `ocean_check`. |
| `.lastChunk`| The chunk index the ocean check last processed; the biome is sampled only when `.chunkNow` differs. |
| `.oceanRun` | Consecutive ocean-biome chunks crossed so far (reset by any non-ocean chunk). |
| `.landRun`  | Consecutive non-ocean chunks crossed since the last ocean chunk (reset by any ocean chunk). |
| `.isOcean`  | `1`/`0`: was the biome under the rider this chunk an ocean? (temp, per chunk). |
| `.fast`     | `1` while the ride is in ocean cruising speed (`.OCEANSPEED`), `0` at the default. |
| `.dbgmx`    | Debug only: the pace cart's `Motion[0]` × 100, printed in the per-chunk debug line so you can see the cart's real speed. |
| `.autodone` | `1` once a ride has ever been started in this world; blocks the auto-starter forever after (persists in the world save). |
| `.trackBase`| World X of index 0 of the track-history list (storage `infinite_rail:track y`). |
| `.sy`       | The rig's smoothed rail-line height this tick, in **milliblocks**: `max(.c1, .s2, .linem)`. |
| `.c1`       | The constructed S-curve height (stateless): blend-average of `lifted()` over ±`.CAMBLEND/2`. |
| `.s2`       | The reactive descent chaser (stateful): eases toward `.linem` by `1/.CAMSMOOTH` per tick. |
| `.dy`       | The chaser's step this tick. |
| `.lift`,`.wmax`,`.half` | Precomputed per tick: `.CAMLIFT`×100 (milli), the per-sample forward-scan reach (`.CAMLIFT` in blocks + 2), and `.CAMBLEND/2`. |
| `.cxm`,`.ci`,`.cmaxi`,`.fx`,`.fi` | Pace-cart X×1000, the rig's column index into the history (cart index + `.CAMAHEAD`, clamped), max valid index, sub-block X fraction (milli, floorMod) and complement — index and fraction derive from the one `.cxm` read so they can't disagree. |
| `.j`,`.cb`,`.tj`,`.tsum`,`.tn` | `cam_blend` loop state: blend offset, sample base column, one `lifted()` value, running sum/count. |
| `.k`,`.si`,`.sj`,`.ya`,`.yb`,`.sm`,`.t2` | `cam_scan`/`cam_sample` state: scan offset, clamped indices, the two column heights, the interpolated sample, scratch (also reused by `cam_move`). |
| `.fmx`,`.l0`,`.linem`,`.ly` | One sample's forward max and its rail line (milli), the rail line at the rig (milli), `cam_get` output. |
| `.veg`      | This column's carve mode, computed by the shared `decide` (§7i): `1` = the bore may spare vegetation outside the critical envelope, `0` = full center clear (slope columns and the `.SLOPECLEAR` buffer after an event). |
| `.vclear`   | Countdown of full-clear columns remaining after an event ends (armed to `.SLOPECLEAR` by `end_event`, decremented per flat column by `decide`). |
| `.retro`    | `1` = a slope just started (raised by the shared `start_event`); the edition's builder retro-clears the center bore of the last `.SLOPECLEAR` columns and resets it to `0`. |
| `.ch`,`.cy` | Carve state: this column's bore height (`.TUNNEL`/`.TUNNELUP`, set by the `place_*` caller) and `carve_layer`'s climbing layer index. |
| `.rk`,`.rt` | `retro_clear` scratch: the clamped retro span and the columns-built count it is clamped against. |
| `.tr`       | `place_torch` scratch: the odds roll, the distance roll, then the side roll (§6.9). |
| `.td`       | `place_torch` scratch: the rolled torch distance (blocks off the centerline, 2..`.TORCHRANGE`). |
| `.fw`       | `forceload_here` scratch: the corridor's Z half-width (8, or the clamped `.TORCHRANGE` while torch mode is on). |

### 4.2 Entities (all tagged, so selectors are unambiguous)

| Tag        | Type            | Purpose |
| ---------- | --------------- | ------- |
| `ir_head`  | `marker`        | The build head. Its position is the current column; it advances east (and up/down on slopes) as track is laid. |
| `ir_probe` | `marker`        | A scratch probe teleported around by `sample_window` (and once by `begin`) onto the terrain surface to read heightmaps into scores. |
| `ir_cart`  | `minecart`      | The hidden **pace cart**. Invulnerable; rides the physical rails `.CAMAHEAD` blocks behind the viewer, kept moving by the stall keeper. Permanently occupied by the plug — a cart with a passenger can't scoop up mobs or be right-click entered. |
| `ir_seat`  | `item_display`  | The **camera seat** — the mover of the rig. Displays no item; `teleport_duration:1` makes the client interpolate its per-tick teleports. Teleported along the smoothed path by `cam_move` every tick; carries the ride cart. |
| `ir_ride`  | `minecart`      | The **ride cart** the player actually sits in — a real minecart, off the rails, permanently a passenger of the seat. The whole stack (seat → ride cart → player) moves rigidly, so the cart can never bounce, tilt or shift against the view. |
| `ir_plug`  | `item_display`  | The **seat-blocker**: permanently occupies the pace cart. |
| `ir_disp`  | `block_display` | One per column: a smooth-stone visual that disguises the redstone block under the rail. Purely cosmetic. |

### 4.3 Command storage

| Storage              | Path      | Purpose |
| -------------------- | --------- | ------- |
| `infinite_rail:tmp`  | `y`(double) | Scratch in `begin` to copy `.railY` into the head marker's `Pos[1]`. |
| `infinite_rail:args` | `gen`(int), `w`(int) | The macro arguments passed to `forceload` (the `.GENAHEAD` distance and the corridor's Z half-width), computed by `forceload_here`. |
| `infinite_rail:cam`  | `dx`(int), `y`(double) | Macro arguments for `cam_tp`: the eastward offset from the pace cart (`.CAMAHEAD`) and the rig's absolute height (`(.sy + 62 + .CAMHEIGHT×100) × 0.001`). X/Z stay relative to the execution position (the pace cart), so they never pass through a scoreboard. |
| `infinite_rail:track`| `y`(list of int) | The **track history**: one rail-Y per built column, appended by `advance` (and once by `begin`); index = world X − `.trackBase`. The camera's entire knowledge of the path. Grows ~4 bytes/column for the life of a ride; reset by `begin`. |
| `infinite_rail:cami` | `i`(int) | Macro argument for `cam_get` (the history index to read). |
| `infinite_rail:speed`| `rule`(string), `v`(int) | Macro args for `set_speed`: the version-correct gamerule name (`rule`, detected once at load) and the value to set (`v`). |
| `infinite_rail:names`| `weather_cycle`, `daylight_cycle` (strings) | The version-correct names of the weather-/daylight-cycle gamerules, set at load by the version-selected `names.mcfunction`. The rain/night mode toggles copy one into `infinite_rail:rule` before calling `set_rule`. (The minecart-speed rule name predates this storage and stays in `infinite_rail:speed rule`.) |
| `infinite_rail:rule` | `rule`(string), `v`(string) | Macro args for `set_rule`: an arbitrary gamerule name and its value ("true"/"false"). |
| `infinite_rail:torch`| `dz`(int) | Macro arg for `torch_at`: the signed Z offset (distance + side in one number) a torch-mode torch lands at. |
| `infinite_rail:carve`| `h`(int), `k`(int) | Macro arguments for the carve fills: the clearance-bore height above the rail (`carve_center`, `retro_fill`) and the retro-clear span behind the head (`retro_fill` only). |

---

## 5. Runtime flow (the big picture)

```
World load / /reload
        │
        ▼
#minecraft:load ─► infinite_rail:load ─► sets up `ir`, .C12, then infinite_rail:config
                                          (applies all tunable knobs)

Player runs /function infinite_rail:start (or the auto-starter fires: tick starts a 5-second countdown timer for the first player to
 appear in a fresh world, while .AUTOSTART=1, .started=0 and .autodone≠1)
        │
        ▼
start ─► (as nearest player, block-aligned) begin
            ├─ reset any previous run, kill old entities, clear forceloads; .autodone=1
            ├─ setup_world (gamerules); apply .MAXSPEED via set_speed; .fast=0
            ├─ summon ir_head + ir_probe markers; initial forceload (via GENAHEAD macro)
            ├─ read terrain here, set .railY = surface + .HOVER, move head to it
            ├─ init counters (.slope=0, .flat=99, .lastDir=0, seed .avg, .nextLoad…)
            ├─ reset the track-history list; .trackBase = .headX; record column 0
            ├─ place the first column; summon ir_cart (pace cart) + ir_plug; plug in cart
            ├─ seed the ocean state (.lastChunk = cart chunk, .oceanRun/.landRun = 0)
            ├─ pre-build .CAMAHEAD+32 columns synchronously
            ├─ summon ir_seat + ir_ride at the head; ride cart onto seat;
            │    mount player INTO THE RIDE CART (the only mount of the ride);
            │    set adventure + Resistance/Saturation
            └─ seed .sy, snap the rig into place (cam_follow), set .started = 1

Every game tick (while .started == 1)
        │
        ▼
#minecraft:tick ─► tick ─► main
                            ├─ sample .cartX (pace cart)
                            ├─ ocean_check: per-chunk biome sample → raise/lower minecart speed
                            ├─ keeper: eject anything but the plug from the pace cart,
                            │    anything but players from the ride cart
                            ├─ keeper: re-mount a dismounted rider into the ride cart
                            ├─ keeper: plug→pace cart, ride cart→seat (self-healing)
                            ├─ keeper: re-boost the pace cart if stalled
                            ├─ cam_follow: fly the rig along the recorded profile,
                            │    .CAMAHEAD blocks ahead of the pace cart (§7g)
                            └─ .budget = .MAXTICK; build_loop
                                   └─ while (.budget>0 AND head−cart < .AHEAD): build_step
                                          └─ advance (build ONE column) ─► build_loop (recurse)

advance (per column)
   1. sample_window ─► .avg (rolling average of the next 48 blocks' surface)
   2. .target = .avg + .HOVER
   2b. near_scan ─► .gfloor/.gmax (the actual ground just ahead — the
       slope-timing guards' inputs, §7j)
   3. decide ─► .dir (-1/0/1)  [event model; may call consider_start]
      (decide also sets .veg, this column's carve mode — §7i)
   3b. if .retro (a slope just started): retro_clear the center bore behind the head
   4. move ir_head and place the column (place_flat / place_up / place_down ─► support)
   5. every 16 blocks: roll_chunks (forceload ahead, unload behind, move spawn)

Player runs /function infinite_rail:stop
        │
        ▼
stop ─► .started=0, dismount, kill cart+markers, clear forceloads (track stays built)
```

---

## 6. File-by-file reference

### 6.1 Metadata & vanilla hooks

**`infinite_rail/pack.mcmeta`**
Pack metadata. Declares the description and version compatibility with the current (25w31a+) scheme: `pack_format` (`84`), `min_format` (`82`) / `max_format` (`107`) — the supported *data-pack* format range (25w31a-era through 26.2; a **separate series** from resource-pack numbers). Also:
- `features.enabled: ["minecraft:minecart_improvements"]` — **the pack itself turns on the Minecart Improvements feature**, so the minecart max-speed gamerule always exists while the pack is loaded (no manual experiment toggle needed for `.MAXSPEED` / the ocean speed-up).
- `overlays.entries` — one overlay, `overlay_snake`, for `min_format` 92 / `max_format` 107. On those versions (25w44a+, snake_case gamerules) the files in `overlay_snake/` replace the base copies (see §2). The `formats` field is omitted deliberately: it's only required when an overlay range dips below format 82, and this pack's floor is 82.

**`data/minecraft/tags/function/load.json`**
Vanilla tag `#minecraft:load`; its `values` list contains `infinite_rail:load`. Makes the game run `load` on world-load and `/reload`.

**`data/minecraft/tags/function/tick.json`**
Vanilla tag `#minecraft:tick`; lists `infinite_rail:tick`. Makes the game run `tick` every game tick.

### 6.2 Initialization & config

**`function/load.mcfunction`**
Runs on load/reload. `scoreboard objectives add ir dummy` (idempotent) creates the objective (plus `ir_menu`, the Settings book's `trigger`-criteria click channel — §6.9); sets the internal constants `.C12 = 12`, `.C16 = 16`, `.C100 = 100`, `.C1000 = 1000`; calls `infinite_rail:config` to apply all tunables; seeds the mode toggles via the shared `modes_init` (add-0, so an enabled mode survives the reload — §6.9); derives `.TUNNELUP = .TUNNEL + 1`; calls `names` to load the version-correct command/gamerule names (the minecart-speed gamerule name into storage `infinite_rail:speed rule`, the weather-/daylight-cycle and chain-budget names into `infinite_rail:names`); **raises the per-chain command budgets** (`maxCommandChainLength` / `maxCommandForkCount` → 1,000,000, via `set_rule` with the version-correct names) — vanilla caps one command chain at 65,536 commands, and the synchronous ride start pre-builds `.CAMAHEAD+32` columns (each with a 24-probe near scan, §7j) in a single chain, which silently truncated `begin` mid-way at the default cap (track built, rider never mounted, `.started` never set); prints a "Loaded" message. Does **not** touch ride state (including `.autodone`), so a `/reload` mid-ride refreshes the knobs without stopping it, and a stopped world stays stopped.

**`function/config.mcfunction`** *(shared source: `src/shared/functions/`)*
The single file a user edits — and the byte-identical source file the Bedrock port runs (§11a). Sets every tunable score (`.HOVER`, `.TUNNEL`, `.CAMHEIGHT`, `.CAMSMOOTH`, `.HIDEHAND`, `.AUTOSTART`, `.MAXSPEED`, `.OCEANSPEED`, `.OCEANCHUNKS`, `.LANDCHUNKS`, `.DEADBAND`, `.SAMEGAP`, `.TURNGAP`, `.SLOPECLEAR`, `.UPCLAMP`, `.DOWNCLAMP`, `.AHEAD`, `.GENAHEAD`, `.MAXTICK`, plus the mode knobs `.SKYY`, `.SKYSPEED`, `.TORCHODDS`, `.TORCHRANGE`) with heavily-commented explanations. The mode *toggles* themselves (`.RAINMODE` & co.) deliberately do NOT live here — a reload re-runs this file and would shut every mode off (see `modes_init`, §6.9). Called by `load` (which then derives `.TUNNELUP`). Its header documents how to apply edits (`/reload`) and that running `config` by itself only re-runs the in-memory copy (so it's only good for resetting live `/scoreboard` tweaks).

### 6.3 Lifecycle / control

**`function/start.mcfunction`**
The player entry point. `execute as @p at @s align xz run function infinite_rail:begin` — runs `begin` as the nearest player, positioned at that player's block (X/Z floored to the grid, so the head marker lands block-aligned).

**`function/begin.mcfunction`**
Sets up and launches a ride (see the flow in §5). Notable steps:
- **Reset:** `.started=0`, `.autodone=1` (a ride has now been started in this world — the auto-starter must never fire again), kill any `ir_head`/`ir_probe`/`ir_cart`/`ir_seat`, `forceload remove all`, dismount the player — so `start` is safely re-runnable.
- **World tuning:** calls `setup_world`; applies the default minecart max-speed (`.MAXSPEED` via the `set_speed` macro) and clears the ocean fast state (`.fast = 0`); if sky mode was left on, re-applies `.SKYSPEED` over the default (`sky_speed`, §6.9).
- **Anchor:** summons the two markers at the player (`~0.5 … ~0.5` = block center); force-loads a small area behind + the `.GENAHEAD` corridor ahead (via `forceload_here` → the `forceload` macro).
- **Initial elevation:** teleports `ir_probe` onto the surface here (`positioned over motion_blocking_no_leaves`), reads its Y into `.railY`, adds `.HOVER`, and writes that Y into the head marker via storage `tmp.y`.
- **Init counters:** `.slope=0`, `.flat=99` (large, so the first change isn't gap-blocked), `.lastDir=0`; seeds `.avg = .railY − .HOVER`; sets `.nextLoad`.
- **Track history:** empties storage `infinite_rail:track y`, sets `.trackBase = .headX` and records the first column's rail Y (index 0).
- **Pace cart:** places the first column (`place_flat`), summons `ir_cart` (invuln, small eastward motion) and `ir_plug`, and plugs the cart. Seeds the ocean-check state: `.lastChunk` = the rider's starting chunk (pace cart chunk + `.CAMAHEAD`), `.oceanRun` and `.landRun` = 0.
- **Pre-build:** sets `.budget = .CAMAHEAD + 32` and runs `build_loop` once synchronously — the head ends up past the rig's starting position, so the viewer starts on ready track.
- **Camera rig:** summons `ir_seat` (`teleport_duration:1`) and `ir_ride` (invuln, yaw 90) at the head, mounts the ride cart onto the seat and the player **into the ride cart** — the one and only player mount of the ride (mount events flash the client's un-hideable "press ⇧ to dismount" hint, so they must never repeat). Adventure mode + **infinite Resistance 255 + Saturation** (can't break track, get hurt, or starve); any leftover invisibility from older pack versions is cleared — the rider is meant to be visible in their cart. (The rider's held item stays hidden because the per-tick keeper clears the inventory.)
- **Handoff:** seeds `.sy = .railY×1000`, runs `cam_follow` once to snap the rig to its cruising position, then `.started=1`.

**`function/setup_world.mcfunction`** (+ `overlay_snake/…/setup_world.mcfunction`)
One-time gamerule tuning for a clean ride: silences command feedback/output/ advancement spam; don't keep origin chunks loaded; no mob griefing (creepers/ endermen can't wreck the track); no fire spread, no phantoms; disabled tile drops; disabled all environmental damage; immediate respawn at the moving spawn point if anything impossible ever happens. It exists in **two copies** because snapshot 25w44a (format 92+, the 26.x era) renamed every gamerule to snake_case and reworked a few (`announceAdvancements` → `show_advancement_messages`, `doInsomnia` → `spawn_phantoms`, `doFireTick` → removed in favor of `fire_spread_radius_around_player`, `spawnChunkRadius` → gone). The base copy is camelCase (formats 82-91); the `overlay_snake` overlay copy is snake_case and **replaces** the base on format 92+ (see §2). `begin` calls `setup_world` once and always gets the right copy — no dropped-file no-op, no duplicate call. Keep the two copies in sync when changing a rule. *(A full names-macro rewrite isn't worth it here: several rules aren't pure renames — `doFireTick`→ `fire_spread_radius_around_player` changes name **and** value, and `spawnChunkRadius` has no 26.x equivalent — so two small whole files read cleaner than one macro'd file plus a big name map.)*

**`function/set_speed.mcfunction`** *(a function macro)*
A single line, `$gamerule $(rule) $(v)` — sets the minecart max-speed gamerule named `rule` to value `v`, both read from storage `infinite_rail:speed`. **The gamerule name is a macro arg, not a literal, on purpose:** a macro line that expands to an *unknown* gamerule aborts the whole function (everything after it is skipped), so we can never afford to emit the wrong-version name. Instead the correct name is set once at load into `rule` by the version-selected `names.mcfunction`, so this line only ever runs the name valid on the running version. The rule always exists because the pack enables the **Minecart Improvements** feature in `pack.mcmeta`. Called by `begin` (with `.MAXSPEED`), `speed_up` (`.OCEANSPEED`, every ocean chunk) and `speed_down` (`.MAXSPEED`).

**`function/names.mcfunction`** (+ `overlay_snake/…/names.mcfunction`)
Sets the version-specific command/gamerule **names** into storage: the minecart max-speed gamerule name into `infinite_rail:speed rule` (`minecartMaxSpeed` in the base copy, `max_minecart_speed` in the overlay), the weather-/daylight- cycle gamerule names into `infinite_rail:names` (`doWeatherCycle`/ `doDaylightCycle` base, `advance_weather`/`advance_time` overlay — used by the rain/night mode toggles through the `set_rule` macro, §6.9), and the command-chain budget gamerule names (`maxCommandChainLength`/`maxCommandForkCount` base, `max_command_chain_length`/`max_command_fork_count` overlay — raised by `load`). This is the tidy home for anything that is a *pure rename* between versions: the base file holds the camelCase names, the `overlay_snake` overlay replaces it with the snake_case names on format 92+, and the shared logic reads the variable. `load` calls it once. Add more entries here as new version-renamed names come up.

**`function/set_rule.mcfunction`** *(a function macro)* `$gamerule $(rule) $(v)` — the generic sibling of `set_speed`, reading both macro args from storage `infinite_rail:rule`. Exists for the same reason (a macro line expanding to an unknown gamerule aborts its function, so the version-correct name must come from `names.mcfunction`, never a literal). Callers copy `rule` from `infinite_rail:names` and set `v` to `"true"`/ `"false"` just before the call. Used by `mode_rain_on/off` and `mode_night_on/off` (§6.9).

**`function/stop.mcfunction`**
Ends the ride: `.started=0`, clears effects from adventure players, takes back the Settings book (`clear … minecraft:written_book`), dismounts them, kills `ir_cart`, `ir_ride`, `ir_seat`, `ir_plug` and both markers, clears all forceloads. `.autodone` stays `1`, so a stopped world never auto-restarts. **The built track (blocks + `ir_disp` displays) is intentionally left in the world.**

**`function/tick.mcfunction`**
The heartbeat. Runs `menu_tick` (the Settings book's `/trigger` dispatcher, §6.9) every tick, ride or no ride, so a click can never sit stale. Then, if `.started == 1`, run `main`. Below that, the **auto-starter**: while `.AUTOSTART == 1`, `.started == 0` and `.autodone ≠ 1`, it waits for a player to exist, then runs a 100-tick countdown before running start, at which point `begin` sets `.autodone = 1` and it never fires again (the score persists in the world save).

**`function/main.mcfunction`**
Per-tick driver while riding:
1. Sample the pace cart's X into `.cartX`. 
1a. **Ocean speed-up:** run `ocean_check` (samples the biome once per chunk the rider enters and raises/lowers the minecart max-speed gamerule).
2. **Purity keepers:** `execute on passengers` ejects anything riding the pace cart that isn't the plug (scooped-up mobs), and anything riding the ride cart that isn't a player.
3. **Rider keeper:** any adventure player not currently riding is re-mounted into the ride cart (handles sneak-dismounts / relog — the only times the vanilla dismount hint can reappear).
4. **Mount keepers:** unconditional `ride … mount` attempts put the plug on the pace cart and the ride cart on the seat; non-player passengers expose no vehicle NBT to query, so the attempt itself is the check (it fails silently while already seated).
5. **Stall keeper:** read `Motion[0]×100` into `.mx`; if `.mx ≤ 10` (speed < 0.1, i.e. stalled) `data merge` the pace cart's motion back to `0.5` east.
6. **Camera:** if the pace cart exists, run `cam_follow` (§7g).
7. Set `.budget = .MAXTICK` and run `build_loop` to extend the track.

**`function/ocean_check.mcfunction`**
The ocean speed-up driver, called each tick from `main` (§7h). Returns immediately while `.SKYMODE` is 1 — sky mode owns the speed, and `mode_sky_off` resets the counters and restores `.MAXSPEED` on the way out. Reads the rider's X from the seat (`.rigX = ir_seat` Pos[0]) and computes its chunk `.chunkNow = .rigX / .C16`; if it equals `.lastChunk` it `return`s immediately (act only when the rider crosses a chunk boundary). Otherwise it records the new chunk, samples the biome **under the rider** (`execute at ir_seat if biome ~ ~ ~ #minecraft:is_ocean` → `.isOcean`) — not the pace cart, which trails `.CAMAHEAD` blocks behind — and updates the run counters: an ocean chunk grows `.oceanRun` (and zeroes `.landRun`), a non-ocean chunk grows `.landRun` (and zeroes `.oceanRun`). While `.oceanRun ≥ .OCEANCHUNKS` (and `.OCEANSPEED > 0`) it calls `speed_up` **each ocean chunk** (re-asserting the ocean speed); crossing `.LANDCHUNKS` non-ocean chunks while fast calls `speed_down` once. When `.DEBUGMODE == 1` it prints each chunk's biome, the running counter and the pace cart's real speed (`.dbgmx`) — but only while the counter is still climbing to its threshold, then it goes quiet.

**`function/speed_up.mcfunction`** / **`function/speed_down.mcfunction`**
The two speed setters. `speed_up` pushes `.OCEANSPEED` through `set_speed` and is called on **every** ocean chunk past the threshold, so the configured speed is continuously re-asserted and always wins over a stray `/gamerule` or a desynced state; its debug line and the `.fast = 1` flip only fire on the first call (while `.fast` is still 0), so there's no spam while cruising. `speed_down` pushes `.MAXSPEED` and is called **once**, on the transition back to land, then leaves the gamerule alone so it can still be hand-tweaked on land.

### 6.4 The build loop

**`function/build_loop.mcfunction`**
Computes `.gap = .headX − .cartX`. If there is budget left **and** the head is closer than `.AHEAD` blocks to the cart, runs `build_step`. This is the loop condition; it builds no column itself.

**`function/build_step.mcfunction`**
`.budget −= 1`, `advance` (build exactly one column), then call `build_loop` again. The `build_loop`⇄`build_step` recursion is a bounded loop: it keeps building columns until either the head is `.AHEAD` ahead of the cart or the per-tick `.budget` is exhausted. (Recursion depth is capped by `.MAXTICK`.)

**`function/advance.mcfunction`**
Builds **one** column (see §7 for the algorithms it drives):
1. Zero `.sum`, run `sample_window` at the head, compute `.avg = .sum / .C12`.
2. `.target = .avg + .HOVER`.
2b. Run `near_scan` at the head → `.gfloor`/`.gmax` (the ground-contact inputs for decide's slope-timing guards, §7j).
3. `decide` → sets `.dir` (-1/0/1) and `.veg` (this column's carve mode, §7i).
3b. If `.retro` (a slope just started): retro_clear the center bore behind the head
4. Move the head and place the column, per `.dir`:
   - `.dir 0`: `tp head ~1 ~ ~`; `place_flat`.
   - `.dir -1`: `tp head ~1 ~-1 ~`; `place_down`; `.railY −= 1`.
   - `.dir 1`: `tp head ~1 ~ ~`; `place_up`; `tp head ~ ~1 ~`; `.railY += 1`.
5. `.headX += 1`.
6. Append the (updated) `.railY` to the track-history list (the camera's map of the path; index = `.headX − .trackBase`).
6b. If `.TORCHMODE` is 1: run `place_torch` at the head — torch mode's random scatter beside the new column (§6.9).
7. If `.headX ≥ .nextLoad`, run `roll_chunks`.

### 6.5 Terrain sampling & the slope decision (the algorithm)

**`function/sample_window.mcfunction`**
Runs positioned at the head. Computes the clamp window `.lo = .avg − .DOWNCLAMP`, `.hi = .avg + .UPCLAMP` (using the previous column's `.avg`). Then, for each of **12** offsets `~4, ~8, … ~48` blocks east: teleport `ir_probe` there and `positioned over motion_blocking_no_leaves` (snaps it to the surface — ignores tree leaves, includes water/lava surfaces so oceans read as sea level); read its Y into `.s`; discard void/ungenerated reads (`.s ≤ −63 → .s = .avg`); clamp `.s` to `[.lo, .hi]`; add to `.sum`. `advance` then divides `.sum` by `.C12` to get the new `.avg`. **The clamp is what makes narrow ravines/spikes barely move the average** (so they get bridged/tunneled level) while broad mountains still shift it. *(This is the one function whose exact number of sample blocks is fixed — `.C12` must equal the count here.)*

**`function/near_scan.mcfunction`** / **`function/near_step.mcfunction`** *(recursive)*
The near-ground scan (§7j), run at the head between the sample window and `decide`. `near_scan` computes the scan reach `.nw = max(.UPLOOK, .DOWNLOOK)` (capped 48), seeds the accumulators, and — if the reach is ≥ 1 — starts `near_step` positioned one block east. Each `near_step` snaps the `ir_probe` marker onto the surface (the same `positioned over motion_blocking_no_leaves` trick as `sample_window`), folds the read and its predecessor into a **pair** (`.pmin` = min of the two — tree trunks vanish, §7j), accumulates `.gfloor` (max pair within `.DOWNLOOK`), `.gmax` (max pair within `.UPLOOK`) and `.gcone` (max 45°-projection `.pmin − distance` over pairs above `.railY − .HOVER`), then hops 2 blocks east and recurses — so the probes land at odd offsets `~1, ~3, ~5, …`. Void/ungenerated reads break the pair chain and are skipped; if the scan got no valid probe at all (`.gnu` = 0), `.gcone` falls back to the `+32000` never-hold sentinel. Both windows 0 = the scan does nothing but set the sentinels.

**`function/decide.mcfunction`**
Chooses this column's `.dir` using the **event model** (§7b). Computes `.diff = .target − .railY`, snapshots `.slope0 = .slope`, and derives the four ground-contact guard flags from the near scan (§7j): `.dig` / `.dig2` (one / two more down-steps would land the rail below the descent floor `.gfloor + .DOWNGRACE`), `.push` (the rail is not yet a full `.HOVER` above the highest ground within `.UPLOOK`, and still under `.target + .UPGRACE`) and `.due` (the climb schedule allows starting: the rail is within `.UPEARLY` of the cone's demanded height `.gcone + .HOVER`). All stay inert while `.SKYMODE` is 1 (sky mode holds `.SKYY` dead level and punches through whatever it meets) or while their scan window knob is 0.
- If an event is in progress (`.slope0 = ±1`): keep sloping the same way until the rail reaches the target — climb while `.diff ≥ 1` **or `.push` is 1** (crest completion: finish at hover height over ground the level line would still hit, up to `.UPGRACE` past the target); descend while `.diff ≤ −1` **and `.dig` is 0** — a blocked descent ends early (`end_event`), resting just above the ground, and the line continues downward as a new, gap-paced event once the ground falls away.
- If flat (`.slope0 = 0`): call `consider_start` to maybe begin a new event.

**`function/consider_start.mcfunction`**
Decides, when flat, whether to begin a climb/descent:
- `.want = 1` if `.diff ≥ .DEADBAND`; `.want = −1` if `.diff ≤ −.DEADBAND` (via `.ndead = −.DEADBAND`); else `0`.
- **Ground-contact overrides (§7j):** a wanted climb is *held* (`.want 1 → 0`) while the schedule says it is not yet due (`.due` 0 — the 45° cone still has more than `.UPEARLY` blocks of headroom; `.flat` keeps counting during the hold). A climb is also wanted inside the deadband (`.want 0 → 1`) when `.diff ≥ 1`, `.gmax > .railY` (the level line is about to plow into rising terrain) and the schedule agrees. A wanted descent is vetoed (`.want −1 → 0`) while `.dig2` is 1 — never start a descent without clear runway for at least two steps; hold level and let the ground fall away first.
- If `.want = 0`: stay flat, `.flat += 1` (count toward the next gap).
- If `.want ≠ 0`: pick `.need = .SAMEGAP` (if `.want == .lastDir`) or `.TURNGAP` (reversal). If `.flat ≥ .need`, call `start_event`; otherwise **hold level** (`.flat += 1`, guarded by `.slope == 0`). Holding is what produces bridges (the ground drops away under a level rail) and tunnels (the ground rises into it).

**`function/start_event.mcfunction`**
Begins an event: `.dir = .want`, `.slope = .want`, `.lastDir = .want`, `.flat = 0`. This column becomes the first sloped column; `decide` continues the slope on subsequent columns until the target is reached.

**`function/end_event.mcfunction`**
Ends an event: `.slope = 0`, `.flat = 0`. `.dir` stays `0`, so the current column is placed flat at the elevation just reached, and gap-counting restarts.

### 6.6 Column geometry (how slopes map to blocks)

All three run positioned at the head; the head is already at this column's `(X, railY, Z)`. **Order matters:** the carve happens first, then `support` (which lays the redstone block *under* the rail), then the rail, then the light — because the track hovers above the ground, so the cell under the rail is air and the rail would pop off if placed before its support existed. The carve height is configurable (`.TUNNEL`), and the carve is **vegetation-sparing** (§7i).

**`function/place_flat.mcfunction`**
Sets the carve height (`.TUNNEL`) into both the `.ch` score (the per-cell walk) and storage `infinite_rail:carve h` (the full-clear fill macro), runs `carve` (3 wide × `.TUNNEL+1` cells tall — the rail cell plus `.TUNNEL` above); `support`; `powered_rail[shape=east_west,powered=true]` at `~`; `light[level=11]` at `~3`.

**`function/place_up.mcfunction`**
Climbing column. Same as flat but carves with `.TUNNELUP` (= `.TUNNEL+1`, one block of extra headroom as the cart rises) and places `powered_rail[shape=ascending_east,powered=true]`. (Slope columns always full-clear their center bore: `decide` sets `.veg` 0 on them.)

**`function/place_down.mcfunction`**
Descending column. Carves with `.TUNNELUP`; places `powered_rail[shape=ascending_west,powered=true]`. (Because a descent moves the head down first, the rail sits one lower and slopes up toward the west behind it, which is the same physical staircase as a climb viewed the other way.)

**`function/carve.mcfunction`**
The vegetation-sparing clearance bore (§7i), positioned at the head. Always clears the **critical envelope** — the rail cell and the cell above it, center only — with one literal `fill`. If `.veg` is 0 (slope / slope-buffer column) it clears the rest of the center bore in one `carve_center` fill; then it walks the bore per-cell with `carve_layer` (`.cy` 0 → `.ch`).

**`function/carve_center.mcfunction`** *(a function macro)*
`$fill ~ ~2 ~ ~ ~$(h) ~ minecraft:air` — the full center clear above the envelope for `.veg 0` columns. `fill` needs literal coordinates, so the height arrives as a macro arg (storage `infinite_rail:carve h`, set by the `place_*` caller to `.TUNNEL` or `.TUNNELUP`).

**`function/carve_layer.mcfunction`** *(recursive)*
One horizontal slice per call, climbing `positioned ~ ~1 ~` from the rail cell to `.ch` above it. Each cell is set to air **unless** it matches the `#infinite_rail:keep` block tag (Java's vegetation list, `tags/block/keep.json`): the two side cells always get the sparing test, the center cell only in veg mode (`.veg` 1) and only from 2 above the rail up (the envelope below was already cleared).

**`function/retro_clear.mcfunction`**
Runs from `advance` when the shared `start_event` raises `.retro` (a slope begins this column): computes the span `.rk = min(.SLOPECLEAR, columns built this ride)` — so it can never reach behind the start point — stores `k`/`h` and delegates to `retro_fill`. Positioned at the head, which still sits on the last **built** column.

**`function/retro_fill.mcfunction`** *(a function macro)*
`$fill ~-$(k) ~2 ~ ~ ~$(h) ~ minecraft:air` — the retroactive full-height center clear over the flat columns just before a slope (they were carved vegetation-sparing, but the camera lifts off the rail line early — §7g). Vertical only: the side cells keep their plants.

**`data/infinite_rail/tags/block/keep.json`**
The `#infinite_rail:keep` block tag — everything the carve spares: Java's edition of the vegetation list, maintained by hand in `src/java/` (Bedrock keeps its own edition in `src/bedrock/bp/scripts/vegetation.js` — the two are independent files because the editions' block naming differs anyway; keep them in policy sync when adding a plant, §11a). Every individual block-id entry is `"required": false`, so a future block rename degrades to "that plant gets carved again" instead of breaking tag loading.

**`function/support.mcfunction`**
Lays the power+disguise under the rail (shared by all three place functions):
- `setblock ~ ~-1 ~ minecraft:redstone_block` — a block of redstone directly under the rail. It **powers the powered rail resting on it**, is **immune to water**, and **emits no light** (so it can't wash away or melt ice). This single block replaces the old 5-block stone/torch/stone stack + barriers.
- `execute align xyz run summon minecraft:block_display …` — a smooth-stone `block_display` (tag `ir_disp`) that disguises the red block. Details that matter:
  - `align xyz` snaps the summon to the block corner (the head is block-centered).
  - `brightness:{sky:15,block:15}` is **required** — a display samples the light of the cell it occupies, which contains the opaque redstone block (light 0), so without the override it renders solid black.
  - `scale:[1, 1.01, 1.01]` / `translation:[0, −0.005, −0.005]` — enlarged a hair in **Y and Z only** so the visible faces (underside + the two sides seen from a bridge) sit just outside the redstone block and don't z-fight it. X stays exactly 1 so neighboring supports (one block apart along the track) touch but never overlap — a uniform >1 scale made adjacent displays overlap and shimmer.

### 6.7 Chunk management

**`function/roll_chunks.mcfunction`**
Runs every 16 blocks of head travel (gated by `.nextLoad` in `advance`), positioned at the head. Runs `forceload_here` (which computes the corridor arguments and calls the `forceload` macro — generate ahead, release behind). Then `setworldspawn` and `spawnpoint @a` at `~ ~1 ~` so world spawn and the player's respawn point **roll forward with the ride** (nothing anchors to the origin); `.nextLoad += 16`.

**`function/forceload_here.mcfunction`**
Computes the `forceload` macro's two arguments into storage `infinite_rail:args` and calls it at the current position (the head for `roll_chunks`, the starting player for `begin`): `gen` = `.GENAHEAD`, and `w` = the corridor's Z half-width — 8 (±1 chunk) normally, raised to `.TORCHRANGE` (capped 48) while torch mode is on, so torches thrown past the standard band still land in loaded, generated chunks instead of silently failing to place.

**`function/forceload.mcfunction`** *(a function macro)*
`forceload` only accepts literal/relative coordinates, not scoreboard values, so both distances arrive as macro args:
- `$forceload add ~ ~-$(w) ~$(gen) ~$(w)` — force-generate the corridor from the head out to `.GENAHEAD` blocks ahead, `$(w)` blocks to each side.
- `forceload remove ~-336 ~-64 ~-256 ~64` — release a band well behind the head; as the head advances 16 at a time these bands tile to clear everything ≳256 blocks back. The ±64 half-width is fixed and generous on purpose: it covers every width the add line can have used (releasing a never-forced chunk is a no-op), so lowering `.TORCHRANGE` mid-ride can't strand wide chunks loaded behind the ride. Runs at the caller's position (head), inherited via the call.

### 6.8 Smooth camera (the ride rig)

**`function/cam_follow.mcfunction`**
The per-tick camera driver, called from `main` (gated on `ir_cart` existing; returns immediately if there is no track history, e.g. the pack was updated over a ride in progress). Reads the pace cart's X once as fixed-point (`.cxm = X×1000`) and derives both the sub-block fraction `.fx` (floorMod) and the rig's column index `.ci` (cart column + `.CAMAHEAD`, clamped to the valid history range) from it; precomputes `.lift`/`.wmax`/`.half`; reads the rail line at the rig (`.linem`, one `cam_sample`); computes the two candidate heights — `.c1`, the constructed S-curve (blend loop `cam_blend`), and `.s2 += (.linem − .s2)/.CAMSMOOTH`, the reactive descent chaser — and takes `.sy = max(.c1, .s2)`, floored at `.linem`; then `cam_move`. See §7g.

**`function/cam_blend.mcfunction`** *(recursive)*
One S-curve sample per call: offset `.j` runs from −`.CAMBLEND/2` to +`.CAMBLEND/2` in steps of 1. Each sample computes `lifted(j) = min(max of the profile over [j .. j+.wmax+1], line(j) + .lift)` via `cam_scan`, and accumulates `.tsum`/`.tn`; `.c1` is their average — an average over a symmetric window reproduces straight stretches exactly and turns every corner of `lifted()` into a parabolic blend `.CAMBLEND` long.

**`function/cam_scan.mcfunction`** *(recursive)*
The small forward-max scan for one blend sample: `.k` runs 0 to `.wmax` in steps of 1, tracking the highest interpolated height `.fmx` and capturing the k = 0 sample as `.l0`. Scanning further than `.CAMLIFT`+2 blocks is pointless (the `+.lift` cap clips anything higher), which is also what keeps lift-off from starting any earlier than the blend needs.

**`function/cam_sample.mcfunction`**
Reads one interpolated profile height into `.sm`: column `.si` (clamped to the built range) and its neighbor, blended by `.fx`/`.fi` so values move continuously as the cart crosses block edges.

**`function/cam_get.mcfunction`** *(a function macro)*
`$execute store result score .ly ir run data get storage infinite_rail:track y[$(i)]` — NBT paths only take literal indices, so the index arrives as a macro arg (storage `infinite_rail:cami i`).

**`function/cam_move.mcfunction`**
Teleports the seat — and with it the rigid ride-cart + rider stack — to `.CAMAHEAD` blocks east of the pace cart at height `.sy + 62 + .CAMHEIGHT×100` milli (62 ≈ how high a minecart rests above a rail, so the ride cart sits on the smoothed line like a real cart). Runs `cam_tp` **positioned at the pace cart**, so X/Z are relative offsets and never pass through a scoreboard (full double precision forever).

**`function/cam_tp.mcfunction`** *(a function macro)*
One line: `$tp @e[type=item_display,tag=ir_seat,limit=1] ~$(dx) $(y) ~` — relative X (the `.CAMAHEAD` offset) and Z with an absolute Y. `tp` only takes literal/relative coordinates, so the values arrive as macro arguments from storage `infinite_rail:cam`.

### 6.9 Ride modes

Optional flavors toggled by chat command (`/function infinite_rail:mode_*`), one `_on`/`_off` pair each — or through the **Settings book**, the in-game menu item pinned into the rider's hotbar (`give_menu`, below). They are **independent switches, not a mutually exclusive mode select** — any combination stacks — and they are **state, not config**: the toggles live in the `.RAINMODE`/`.NIGHTMODE`/`.TORCHMODE`/ `.SKYMODE` scores (§4.1), seeded by the shared `modes_init` and untouched by `config`, so a `/reload`, a ride restart, `stop`, or a rejoin never turns a mode off. The knobs shaping them (`.SKYY`, `.SKYSPEED`, `.TORCHODDS`, `.TORCHRANGE`) are ordinary config tunables.

**`modes_init.mcfunction`** *(shared source: `src/shared/functions/`)*
Seeds all four toggle scores with `scoreboard players add … 0` — creates a missing score at 0, leaves a set one alone. Called from `load` (Java) and the script's `init()` (Bedrock).

**`function/mode_rain_on.mcfunction`** / **`mode_rain_off.mcfunction`**
Permanent rain. `_on` freezes the vanilla weather cycle (the version-correct gamerule via `names` → `set_rule`) and runs `weather rain` — with the cycle frozen the rain can never time out. `_off` re-enables the cycle and clears the sky. Pure world state: works with or without a ride running.

**`function/mode_night_on.mcfunction`** / **`mode_night_off.mcfunction`**
Endless night: same pattern with the daylight-cycle gamerule plus `time set midnight` (frozen, moon at its peak). `_off` re-enables the cycle and sets morning.

**`function/mode_torches_on.mcfunction`** / **`mode_torches_off.mcfunction`**
Flip `.TORCHMODE`; the placement itself is `place_torch`/`torch_try`, hooked into `advance` (step 6b).

**`function/place_torch.mcfunction`**
Runs positioned at the head, once per built column while `.TORCHMODE` is 1. Roll one (`random value 1..100` vs `.TORCHODDS`): does this column get a torch at all? Roll two: how far out — `/random` can only roll literal ranges, so a fixed `0..99` roll is scaled in fixed point to a uniform 2..`.TORCHRANGE` distance (clamped 2–48; the floor of 2 stays clear of the 3-wide carve). Roll three (`0..1`): which side — the result is written to storage `infinite_rail:torch dz` with store scale **+1 or −1**, folding distance and side into one signed offset for the macro hop.

**`function/torch_at.mcfunction`** *(a function macro)*
`$execute positioned ~ ~ ~$(dz) run function infinite_rail:torch_try` — positions can't come from scoreboards, so the signed Z offset arrives as a macro arg. Runs at the head (inherited from `place_torch`'s caller).

**`function/torch_try.mcfunction`**
Plants one torch at the rolled X/Z if — and only if — it can actually stand: `positioned over motion_blocking_no_leaves` snaps to the surface (under forest canopy, not on it), `setblock … keep` only fills air, and the ground below must not be water, lava, ice, a snow layer or a lily pad. A skipped torch is invisible; a floating or popped one is not, so every doubtful spot is skipped.

**`function/mode_sky_on.mcfunction`** / **`mode_sky_off.mcfunction`** / **`function/sky_speed.mcfunction`**
The high-altitude cruise. The elevation half lives in the **shared `decide`**: while `.SKYMODE` is 1 the terrain-derived `.target` is replaced with `.SKYY` before any slope decision, so the ordinary event model climbs to it in one contiguous 45° event, holds it dead level (the target never moves), and glides back down when the mode ends — no new machinery, just a different opinion about where the rail wants to be. The terrain sampler keeps running underneath, so the descent lands correctly wherever the ride happens to be. The speed half: `_on` applies `.SKYSPEED` (via `sky_speed`, which `begin` also re-applies if a ride starts while the mode is on) and `ocean_check` returns early while the mode is on; `_off` restores `.MAXSPEED` and zeroes `.fast`/`.oceanRun`/`.landRun` so the ocean system resumes fresh. Terrain above `.SKYY` is punched through like any rise the rail can't out-climb.

**`function/modes.mcfunction`**
Status printout: one `tellraw` line with all four toggle scores.

**`function/give_menu.mcfunction`** — *the Settings book (the mode menu)*
Pins a written book titled **"Settings"** into the rider's last hotbar slot (`item replace … hotbar.8`). Its one page is a 1.21.5+-format SNBT text component: `[On]`/`[Off]` links per mode plus a `[Current modes]` line, each a `click_event:{action:"run_command",command:"trigger ir_menu set <n>"}` (no leading slash; the page root is an empty `{text:""}` so its style can't inherit into the children). `main` calls it for every adventure player
**right after the per-tick inventory clear** — the clear wipes the book, `give_menu` re-pins it, so at every tick boundary the book exists and nothing else ever accumulates; `stop` takes it back.
**Why the clicks go through `/trigger` and not `/function`:** book clicks run the command as the clicking player, and since 1.21.6 any click-event command that needs elevated permissions pops a *"command requires elevated permissions"* confirmation screen on every single click — even for operators. `/trigger` runs at permission level 0, so the links never confirm and never need operator; `menu_tick` turns the triggered number into the real mode call at function permission level. (Bedrock's menu is a native `@minecraft/server-ui` form driven by the script — §11a/§11e.)

**`function/menu_tick.mcfunction`**
The click dispatcher, run from `tick` every tick (ride or no ride, so a click can never go stale): maps `ir_menu` values 1–8 to the four `mode_*_on`/`_off` functions and 9 to `modes`, executed `as` the triggering player, then `reset`s and re-`enable`s the objective for everyone (a trigger objective disables itself per player after each use, and reset drops the enabled flag with the score — so both lines run, in that order). The `ir_menu` objective itself is created by `load`.

*(Bedrock: rain/night are the same commands with Bedrock's stable lowercase gamerule names; sky/torches only flip the score and `scripts/main.js` does the native work — see §11a.)*

---

## 7. The algorithms in depth

### 7a. Heightmap sampling → rolling average
Per column, `sample_window` reads the surface Y at 12 points spread over the next 48 blocks and averages them into `.avg`. Two safeguards: void/ungenerated reads (`≤ −63`) are replaced by the previous average, and each sample is **clamped to `±.DOWNCLAMP / +.UPCLAMP` around the previous average**. The clamp is the "smoothing" dial: small values make the line ignore sudden dips/spikes (they get bridged/tunneled level); large values make it hug the terrain closely.

### 7b. The event model (slope shaping)
The target elevation is `.avg + .HOVER`. Rather than nudging one block at a time, the rail moves in **events**: once it decides to climb or descend, it does so as a single unbroken 45° run (`.slope` persists; `decide` keeps `.dir` nonzero) until `.railY` reaches the target — never "up, flat, up, flat" (a descent may also end early, resting just above ground the next step would cut into — §7j). Between events the rail is flat, and two spacing gaps govern when a new event may start: `.SAMEGAP` (repeat the same direction) and `.TURNGAP` (reverse). `.DEADBAND` adds hysteresis so terrain noise below that height difference is ignored. When a change is *wanted* but a gap forbids it, the rail **holds level** — which is exactly what turns into a **bridge** (ground falls away) or a **tunnel** (ground rises into the carve). So bridges and tunnels are not special cases; they emerge from "hold the line until the gap allows a change." On top of this, the **ground-contact guards** (§7j) re-time and re-bound events against the actual surface just ahead — always *within* the gap rules, never around them.

### 7c. Column geometry (how slopes map to blocks)
`advance` moves the head and picks the place function by `.dir`:
- **Flat:** head east +1; rail at `railY`.
- **Climb:** head east +1; place `ascending_east` at the *current* `railY`; then head up +1 and `.railY += 1`. So each climbing column's rail is one higher than the last — a staircase of ascending rails a minecart takes as a smooth 45° line.
- **Descend:** head east +1 **and down −1**; place `ascending_west` at the new (lower) `railY`; `.railY −= 1`. Each column then carves clearance above, lays the redstone support below, sets the rail, and adds the light (§6.6).

### 7d. Power & the disguise
Every rail is `powered=true` and sits directly on a **block of redstone**, which powers it (a rail resting on a redstone power source is activated) with no torch, no support stack, and no barriers. Because a raw redstone block would show red from the side of a bridge, each one is covered by a smooth-stone `block_display` (`ir_disp`). The display needs a `brightness` override (it sits inside an opaque block → samples light 0 → would be black) and a Y/Z-only oversize (to cover its visible faces without overlapping neighbors). Cost per column: **1 block + 1 display + 1 rail** (down from 5 blocks + 1 rail in the old torch design).

### 7e. Chunk loading / unloading
`forceload` generates a corridor `.GENAHEAD` blocks ahead of the head so the heightmap scanner always has real terrain, and releases chunks a few hundred blocks behind. There are **two independent look-ahead distances**: `.AHEAD` (how far ahead of the *cart* the rails are laid) and `.GENAHEAD` (how far ahead of the *rail head* the world is generated) — so terrain exists ≈ `.AHEAD + .GENAHEAD` ahead of the cart. Memory stays flat (passed chunks unload), though vanilla commands can't delete chunks from disk, so the world folder still grows slowly.

### 7f. The keepers
Per-tick guards in `main` make the ride truly unbreakable: anything riding the pace cart that isn't the plug is ejected, as is anything riding the ride cart that isn't a player; a dismounted rider is re-mounted into the ride cart; the plug and the ride cart are re-mounted onto their perches (unconditional attempts that fail silently while already seated); and if the pace cart's eastward speed ever drops near zero it's re-boosted to `0.5`. The ride cart's pitch is locked horizontally, and the player's inventory is cleared every tick — then the **Settings book** (the mode-menu item, §6.9) is handed straight back into the last hotbar slot by `give_menu`, so the book is always there and nothing else ever accumulates. Combined with the always-powered rails, the ride can never stop — and because both carts always carry a passenger, neither can be entered by right-click or scoop up passing mobs.

### 7g. The smooth camera (the ride rig)
Java has no `/camera` command (that's Bedrock-only), so the pack uses the vanilla-Java equivalent — a riding stack teleported along a smoothed path. The design has three pillars:

1. **One rigid rig, one mount, zero transitions.** The player sits in a real minecart (`ir_ride`) that is itself a permanent passenger of the interpolated camera seat (`ir_seat`). Clients position passengers from their vehicle every frame, so seat → ride cart → player move as a single rigid body: the cart the player sees can never bounce, tilt or shift against their view, and eye height is genuine minecart-passenger parity by construction — no calibration, no mount swaps. The player mounts exactly once per ride; this matters because every player mount event flashes the client's "press ⇧ to dismount" hint, which cannot be suppressed server-side. (Vehicle-swap designs also physically move the player, because passenger attachment offsets differ between entity types — the rig sidesteps both problems.)
2. **A constructed S-curve, not a chase.** The pack *built* the track, so it knows the exact elevation profile — `advance` records every column's rail Y into a storage list. From it the camera height is **constructed statelessly each tick** as the higher of two candidate curves:
   - `c1`, the S-curve: take `lifted(x) = min(max of the profile over the next ~.CAMLIFT+2 blocks, railY + .CAMLIFT)` — the rail line raised by `.CAMLIFT` wherever the track climbs, rising just before climb corners and flattening at the summit level `.CAMLIFT` early — then **average it over a symmetric ±`.CAMBLEND/2` window**. The average reproduces straight stretches *exactly* (level on flats, truly parallel at 45° mid-climb — no lag, no exponential tail) and turns every corner of `lifted()` into a parabolic blend `.CAMBLEND` long. Result: the camera lifts off ~`.CAMBLEND/2 + .CAMLIFT + 2` blocks before a climb, is already moving parallel when the slope arrives, rides it precisely, then decelerates and lands **level, exactly at the summit height** — no 45°-pin, no kink. The blend never stretches across a whole slope, so smoothing can't accumulate into tunnel-roof collisions.
   - `c2`, the descent chaser: the classic reactive ease toward the rail line by `1/.CAMSMOOTH` per tick — it floats above the line as the track drops away and settles into valleys (on descents `lifted()` hugs the line, so `c2` wins the max; on climbs it lags below and is ignored). A final floor at the rail line means the rig can never sink into the track.
3. **A hidden cart sets the pace.** The rig rides `.CAMAHEAD` blocks east of the pace cart (`ir_cart`), which rolls along the physical rails behind the viewer, out of forward view. Whatever speed the rails push it — including a changed minecart max-speed gamerule under the `minecart_improvements` feature — the rig inherits automatically; there is no hard-coded velocity anywhere. The pack sets that gamerule to `.MAXSPEED` at start and to `.OCEANSPEED` over long ocean stretches (§7h), and the rig simply follows.

Because riding only carries *position* (never view), the player keeps full free-look — better than Bedrock's `/camera`, which locks the view. The rider is visible, sitting in their gliding cart like on any minecart ride. (The ride cart, being off-rail, doesn't pitch on slopes — it glides level through the smoothed climbs, which reads naturally with the eased motion.)

### 7h. The ocean speed-up
A long ocean crossing is the one stretch with nothing to look at, so the ride quietly picks up speed over open water. Each tick `ocean_check` maps the **rider's** X (the seat, `.CAMAHEAD` ahead of the pace cart) to a chunk index (`.rigX / 16`) and acts only when that index changes — i.e. once per chunk the rider enters. Sampling at the rider, not the far-behind pace cart, is what makes the speed reflect the water the viewer is actually over. On each new chunk it samples the biome directly under the rider with `execute at ir_seat if biome ~ ~ ~ #minecraft:is_ocean` (the vanilla tag that covers every ocean-named biome: ocean, plus the deep/warm/lukewarm/cold/frozen variants). Two run counters follow the crossing: `.oceanRun` counts consecutive ocean chunks (any land chunk zeroes it), `.landRun` counts consecutive non-ocean chunks (any ocean chunk zeroes it). Once `.oceanRun` reaches `.OCEANCHUNKS` the ride sets the minecart max-speed gamerule to `.OCEANSPEED` (`speed_up`) and keeps re-asserting it every ocean chunk, so the configured ocean speed always wins — even over a manual `/gamerule` change; once back on land, when `.landRun` reaches `.LANDCHUNKS` it drops back to `.MAXSPEED` (`speed_down`) a single time and then leaves the gamerule alone (so the land default stays hand-tweakable). The hysteresis (`.LANDCHUNKS` of land before reverting) keeps small islands or gaps from flip-flopping the speed. Because it drives the *same* gamerule the pace cart already obeys, the smooth camera (§7g) inherits the new speed with zero extra work. `.OCEANSPEED 0` disables the whole feature. Like all minecart-speed control, this needs the world's **Minecart Improvements** feature enabled; without it the speed writes are no-ops and the ride cruises at vanilla pace throughout.

### 7i. Vegetation-sparing clearing
The clearance bore no longer flattens everything in its 3×(`.TUNNEL`+1) box. Per cell, the rules are:

- **Critical envelope — always cleared:** the rail cell and the cell above it, center only (the cart and rider pass through here), plus everything the column *places* (support below, rail, light at rail+3).
- **Vegetation-sparing — everywhere else:** the side cells (Z−1/Z+1, every height) and the center cells ≥ 2 above the rail are cleared **unless** they hold natural vegetation — tree trunks, leaves, giant mushrooms, bamboo, sugar cane, flowers, vines, crops, water plants… Terrain (stone, dirt, sand) is never spared, so tunnels bore exactly as before; the ride just brushes *through* forests instead of mowing a square canyon.
- **The slope exception — full center clear:** the camera floats up to `.CAMLIFT` above the rail line entering, riding and leaving slopes (§7g), so overhead vegetation there would brush the rider. Slope columns, and `.SLOPECLEAR` flat columns on **each side** of every slope, clear their full center bore unconditionally. Vertical only — the side cells spare vegetation even there.

The **which-columns logic is shared** (it lives in the same shared `.mcfunction` brain both editions run): `decide` computes `.veg` per column (0 on slope columns, and while `.vclear` — armed to `.SLOPECLEAR` by `end_event` — counts down after a slope), and `start_event` raises `.retro`, telling the edition's builder to retroactively full-clear the center bore of the `.SLOPECLEAR` columns *before* the slope (they were already built when the slope was decided). `tools/simulate.mjs` asserts the `.veg`/`.retro` contract on both emitted copies.

The **what-is-vegetation list is per edition**: Java's is the `#infinite_rail:keep` block tag (`src/java/data/infinite_rail/tags/block/keep.json`, tested per cell by `carve_layer` with `execute unless block … #infinite_rail:keep`); Bedrock's is `src/bedrock/bp/scripts/vegetation.js`, whose `isVegetation()` `placeColumn()` calls on each cell's typeId (Bedrock commands have no block tags). The two files are maintained by hand as a pair — the editions' block ids and grouping mechanisms differ anyway (Java has vanilla group tags, Bedrock matches id fragments), so each spells the same policy natively; keep them in sync when adding or removing a plant.

Two deliberate consequences: a tree trunk dead on the centerline keeps its crown (the envelope punches a 2-block gap through it, plus the light cell at rail+3), and spared leaves with no log left in range decay naturally — that's vanilla behavior, not a bug.

### 7j. Ground-hugging slope timing (the near scan)

The rolling average (§7a) is good at deciding **where** the line wants to be, but bad at deciding **when** to move: it is a 48-block forward *mean*, so it lags and dilutes around edges. Left alone, that produces three signature uglinesses — the line starts a descent while still crossing high ground (trenching down through a mountain's tail to get a head start on the valley beyond), it descends a level or two *into* a valley floor it is about to leave anyway (dip, cruise in a trench, then descend again), and it ends climbs at the crest-diluted average, tunneling right under hilltops.

The fix is a second, much shorter terrain read: the **near scan**. Each edition natively probes the surface every 2 blocks over the next `max(.UPLOOK, .DOWNLOOK)` blocks (odd offsets +1, +3, …; Java: the `near_scan`/`near_step` probe recursion; Bedrock: `nearScan()` over the memoized `surfaceY()` reads — effectively free there). Consecutive probes are folded into **pairs** — `min(this, previous)` — because the heightmap counts tree trunks as ground: a 1-2 block spike only ever catches one probe of a pair, so the min erases it, while real terrain (4+ blocks wide) spans both probes and registers. (Dense multi-trunk canopies, e.g. jungle, can still read as raised ground — the known limit of a block-blind probe.) The pairs boil down to three integers handed to the shared brain beside `.target`/`.railY`: **`.gfloor`** (highest pair within `.DOWNLOOK` — the ground that governs descents), **`.gmax`** (highest pair within `.UPLOOK` — the climb contact/crest trigger) and **`.gcone`** (the **climb schedule**: over pairs actually *in the way* — above `.railY − .HOVER`, since ground the line already clears level needs no climb — the highest 45°-projection `height − distance`, i.e. the height the rail must *already* be at for a 45° ramp from here to crest everything coming). From them the shared `decide`/`consider_start` apply five rules:

- **Descend late** (start veto, `.dig2`): a descent may not *start* without clear runway — room for at least two down-steps above the **descent floor**, `.gfloor + .DOWNGRACE`. Wanting to descend while ground within `.DOWNLOOK` is still in the way just holds the level (counting `.flat` like any hold); the descent then begins at the drop-off and glides down in open air. Dips and gaps *narrower* than `.DOWNLOOK` never get descended into at all — they are crossed level (bridged), which is also what keeps the line from diving into a slot it would only have to climb straight back out of.
- **Floor stop** (continue guard, `.dig`): a descent in progress **ends** when one more step would land the rail below the descent floor, resting just above the ground it was about to cut into; once the ground falls away, the next descent event carries on — ≥ `.SAMEGAP` later, exactly like any other event. Because every placed descent column was validated against the *tallest* ground it overlooks, **descents physically cannot trench** — and because every stop is a real, gap-paced event end, long descents down rough slopes come out as clean 45° swoops separated by proper benches, never 1-2 column stair-steps.
- **Climb on schedule** (`.due` gate): a wanted climb is *held* — even with the average begging for one — until the rail is within `.UPEARLY` blocks of the height the 45° cone demands (`.gcone + .HOVER`). This is what stops the line ramping up 30+ blocks before a mountain just because the 48-block average saw it coming: ramps start `height + ~.UPEARLY` before the crest and top out `~.UPEARLY` columns early. The held columns keep counting `.flat`, so waiting can never cause a gap-block later; and the multi-feature case resolves itself — the *nearest binding* crest dominates the projection until a taller, farther peak's projection overtakes it.
- **Climb early** (deadband override): when the level line would physically plow into terrain within `.UPLOOK` (`.gmax > .railY`), the average agrees the ground is rising (`.diff ≥ 1`) and the schedule agrees (`.due`), the climb is wanted even though `.diff` is still inside `.DEADBAND`. The spacing gaps still have the final say.
- **Crest completion** (`.push`): a climb in progress keeps climbing until it rides a full `.HOVER` above the highest ground within `.UPLOOK` (`.railY < .gmax + .HOVER`), up to `.UPGRACE` blocks above the target. Wide hilltops (whose beyond-crest downslope dilutes the average below the summit) get ridden *over* at proper hover height instead of tunneled just under — without this the climb would stop a block low and park there inside the deadband; anything taller than the `.UPGRACE` budget still gets punched, so narrow rock fins don't turn into bobbing.

Priorities and safety: the gaps always win (`.SAMEGAP`/`.TURNGAP` gate every event exactly as before — the guards only hold events back, stop them early, or extend one already running; they never place events closer together); sky mode bypasses all five rules (it holds `.SKYY` dead level and punches through, as documented); and the sentinels fail safe — `.gfloor`/`.gmax` arrive as `−10000` on no data (their guards pass, plain event behavior), `.gcone` as `−10000` when nothing ahead needs climbing (the gate holds — nothing to be due for) and `+32000` when the scan had no data at all (the gate never holds). Setting `.UPLOOK`/`.DOWNLOOK` to 0 disables each side wholesale; `.UPGRACE 0` disables only the overshoot; `.UPEARLY ≥ ~50` disables only the schedule.

`tools/simulate.mjs` locks the behavior in: it feeds the same near-scan values to both editions' emitted brains, asserts no descent column ever lands below the descent floor, that descents never start without two-step runway and never end while the floor below is clear, that climbs never start ahead of schedule, allows climb starts inside the deadband only with logged ground contact, and runs three purpose-built terrains — `mesa` (the line must cross a high tabletop level and descend only at the drop-off, where it used to trench down through the last ~45 columns of the top), `ridge` (a narrow ridge diluted to `.diff = 1`, reachable only through the early-climb + crest-push path) and `hillside` (a long 1:2 downhill face descents must take as gap-paced 45° swoops without ever entering the ground).

---

## 8. Tuning

All knobs live in `config.mcfunction` (see the table in §4.1). **To apply edits: change the value, then run `/reload`** (or rejoin the world) — the game re-reads the file and re-runs `config`, updating a ride already in progress. To experiment without editing the file, set a score live, e.g. `/scoreboard players set .HOVER ir 8` (takes effect on the next column; wiped on the next `/reload`/rejoin). Running `/function infinite_rail:config` by itself does **not** pick up file edits — it re-runs the copy already in memory.

Current defaults in `config.mcfunction`: `.HOVER 2`, `.TUNNEL 6`, `.CAMHEIGHT 0`, `.CAMBLEND 6`, `.CAMSMOOTH 6`, `.CAMLIFT 20`, `.CAMAHEAD 64`, `.CAMMODE 0`, `.CARTYOFF 12`, `.HIDEHAND 1`, `.AUTOSTART 1`, `.MAXSPEED 8`, `.OCEANSPEED 32`, `.OCEANCHUNKS 6`, `.LANDCHUNKS 3`, `.DEADBAND 2`, `.SAMEGAP 40`, `.TURNGAP 40`, `.SLOPECLEAR 8`, `.UPCLAMP 250`, `.DOWNCLAMP 20`, `.UPLOOK 50`, `.UPGRACE 10`, `.UPEARLY 6`, `.DOWNLOOK 16`, `.DOWNGRACE 1`, `.AHEAD 224`, `.GENAHEAD 192`, `.MAXTICK 15`, `.DEBUGMODE 0`, `.SKYY 180`, `.SKYSPEED 18`, `.TORCHODDS 35`, `.TORCHRANGE 32`. (These are tuned to taste and change often; the algorithm works across a wide range. The gaps and deadband are far lower than the pre-camera 50/50/4 because the profile-driven camera erases slope corners entirely, so frequent small elevation changes are now visually free. `.AHEAD` includes the `.CAMAHEAD` offset — the viewer sees roughly `.AHEAD − .CAMAHEAD` blocks of ready track ahead.)

---

## 9. Limitations & gotchas

- **Disk usage grows.** Commands can unload chunks (memory stays flat) but can't delete them from disk, so a very long ride slowly grows the world folder.
- **Single rider.** One cart, one occupant; designed for a solo viewer.
- **Overworld only.** The Nether's bedrock ceiling confuses surface heightmaps.
- **Very low `.HOVER`.** The redstone support is immune to water, but the *rail* is not — at `.HOVER 0` or below, the rail itself can sit in water and wash out. Keep the track hovering above sea level. (The power source is safe regardless.)
- **Pack-ice tunnels.** The `light[level=11]` block is exactly at the ice-melt threshold, so it doesn't melt ice; the redstone block emits no light. So the power stays safe, but a `light` level raised above 11 could melt ice into the bore.
- **Display entities accumulate** in the built (and saved) chunks like any block; they unload behind the ride with their chunks. `brightness:{sky:15,block:15}` is full-bright, so the disguised stone won't dim at night — lower `block` toward 0 in `support.mcfunction` if that reads as too bright.
- **Track history grows.** The camera's profile list gains one int (~4 bytes) per column for the life of a ride — a few MB after a multi-day ride. It's reset on every fresh `start`.
- **Sub-block camera math degrades past X ≈ ±2,147,000.** The cart's X×1000 fraction read overflows a scoreboard int out there (~3 days of continuous riding); the camera would get a garbage sub-block fraction (≤1 block of jitter, track itself unaffected). Everything else uses NBT doubles.
- **Updating the pack over a ride in progress** leaves the camera idle (no track history exists for the already-built line). Run `start` again to begin a ride with the full system.
- **The pace cart is visible looking backward** — an empty-looking minecart rolling `.CAMAHEAD` blocks behind the viewer. Raise `.CAMAHEAD` to push it further out of sight (keep `.AHEAD` at least ~40 above it, and `.AHEAD` below ~250 so the rolling forceload never releases the pace cart's chunk).
- **The vanilla dismount hint** ("press ⇧/left-ctrl to dismount") is a client-side toast shown on every player mount event; it cannot be hidden by a server or data pack. The rig design means it appears exactly once, at ride start (and again only if the rider dismounts themselves and is re-caught by the keeper).
- **Auto-start on upgraded worlds.** `.autodone` didn't exist before the smooth-camera update, so a pre-existing world that had used the pack will auto-start once on its first load after upgrading (its `.autodone` is unset). Run `stop` once, or set `.AUTOSTART 0`, if that's unwanted.
- **The pack raises the command-chain budget gamerules.** `load` sets `maxCommandChainLength` and `maxCommandForkCount` to 1,000,000 (defaults 65,536) — the ride start builds ~a hundred columns, each with a near-ground scan, inside one command chain, and at the vanilla cap the chain was silently truncated mid-`begin` (rider never mounted). Like the `setup_world` rules, this persists in the world until changed by hand.
- **File edits need `/reload`.** See §8 — the single most common point of confusion.
- **Ride modes persist on purpose.** The `mode_*` toggles (§6.9) survive `stop`, `/reload` and rejoins, and rain/night mode set plain vanilla world state (weather-/daylight-cycle gamerules + `/weather`/`/time`) that nothing in the pack unwinds automatically. Run the `_off` functions to restore vanilla behavior; uninstalling the pack while rain/night are on leaves the cycles frozen until re-enabled by hand.
- **Minecart speed & the feature flag.** `.MAXSPEED` and the ocean speed-up (§7h) drive the minecart max-speed gamerule, which exists only with the **Minecart Improvements** feature. The pack **enables that feature itself** (`features.enabled` in `pack.mcmeta`), so the gamerule is present whenever the pack is loaded — no manual experiment toggle needed. The rule is named `minecartMaxSpeed` on formats 82-91 and `max_minecart_speed` on 92+ (renamed in 25w44a); `names.mcfunction` (base vs `overlay_snake`) supplies the right name into `rule` and `set_speed` runs only that one (a macro line that expands to an unknown gamerule would abort the function, so the wrong name is never emitted). If a speed change still doesn't take, set `.DEBUGMODE 1` — it prints the speed being set and the pace cart's real `Motion[0]×100` each chunk.
- **The rider's held item is hidden by inventory clearing; the arm itself differs by edition.** Both editions keep the rider's inventory empty every tick, so nothing is ever held. On **Bedrock** the bare arm is then hidden too (`.HIDEHAND`, default on): `/hud` has no `hand` element, so the pack applies an invisibility effect to the rider — the one vanilla mechanism that reaches the first-person arm — at the cost of the rider's body also being invisible in third-person/F5. On **Java** there is no mechanism at all (no `/hud`, and invisibility doesn't hide Java's first-person arm), so the Java rider keeps their empty arm.

---

## 10. Quick map (function → what calls it)

```
#minecraft:load ─ load ─┬─ config   (then load derives .TUNNELUP)
                        ├─ modes_init   (seed the mode toggles, add-0)
                        └─ names   (version-selected by overlay: gamerule names → storage)
#minecraft:tick ─ tick ─┬─ main ─┬─ build_loop ⇄ build_step ─ advance ─┬─ sample_window
                        │        │                                     ├─ near_scan ⇄ near_step   (.gfloor/.gmax/.gcone for decide's guards — §7j)
                        │        │                                     ├─ decide ─ consider_start ─ start_event
                        │        │                                     │                 └─ (decide also calls) end_event   (shared-to-shared calls hop through the bare-name ir_* bridges)
                        │        │                                     ├─ (if .retro) retro_clear ─ retro_fill (macro)
                        │        │                                     ├─ place_flat / place_up / place_down ─┬─ carve ─┬─ carve_center (macro)
                        │        │                                     │                                      │         └─ carve_layer (recursive)
                        │        │                                     │                                      └─ support
                        │        ├─ .cartX read                        ├─ (track-history append)
                        │        │                                     ├─ (if .TORCHMODE) place_torch ─ torch_at (macro) ─ torch_try
                        │        ├─ ocean_check ─ speed_up / speed_down ─ set_speed (macro)
                        │        ├─ (keepers + give_menu, inline)      └─ roll_chunks ─ forceload_here ─ forceload (macro)
                        │        └─ cam_follow ─┬─ cam_blend ⇄ cam_scan ⇄ cam_sample ─ cam_get (macro)
                        │                       └─ cam_move ─ cam_tp (macro)
                        ├─ menu_tick   (the Settings book's /trigger relay: ir_menu → mode_* / modes)
                        └─ (auto-start, once per world) start

/function infinite_rail:start ─ start ─ begin ─┬─ setup_world (version-selected by overlay)
                                               ├─ set_speed (macro, apply .MAXSPEED)
                                               ├─ forceload_here ─ forceload (macro)
                                               ├─ (track-history reset)
                                               ├─ place_flat (first column) ─ summon ir_cart + ir_plug
                                               ├─ build_loop … (pre-build past the rig position)
                                               ├─ summon ir_seat + ir_ride, mount the stack
                                               └─ cam_follow (snap the rig into place)
/function infinite_rail:stop  ─ stop

/function infinite_rail:mode_rain_on|off   ─ (names →) set_rule (macro) + weather /function infinite_rail:mode_night_on|off  ─ (names →) set_rule (macro) + time /function infinite_rail:mode_torches_on|off ─ .TORCHMODE (read by advance step 6b) /function infinite_rail:mode_sky_on|off    ─ .SKYMODE (read by decide + ocean_check) + sky_speed / set_speed /function infinite_rail:modes              ─ status printout
```

---

## 11. The Bedrock Edition port & the shared codebase

The repository is a monorepo: `src/shared/functions/` + `src/java/` build the Java data pack documented above, and `src/shared/functions/` + `src/bedrock/` build a native **Bedrock behavior pack** (`tools/build.mjs`; see `BUILDING.md` for the workflow). The port is not a transliteration of the Java files — it is the same *design* re-implemented on Bedrock's strengths, sharing the one part that is pure algorithm.

### 11a. The logic boundary: what is shared and what is native

**Shared (identical `.mcfunction` source, both editions):** the event-model brain — `decide`, `consider_start`, `start_event`, `end_event` — plus `config` and `modes_init` (the ride-mode toggle seeding, §6.9). These are pure scoreboard math on the `ir` objective. Each engine boils its world down to five integers per column (`.target`, `.railY`, and the near-ground scan's `.gfloor`/`.gmax`/`.gcone` — §7j), calls `decide`, and reads back one integer (`.dir`). All event state (`.slope`, `.flat`, `.lastDir`, the gap rules, the deadband, the ground-contact guards) lives *only* inside the shared files, so the slope-shaping behavior of the two editions cannot drift apart. `tools/simulate.mjs` enforces this in CI by interpreting both emitted copies over synthetic terrains and failing if their decisions ever differ.

The carve-mode logic rides along in the same shared files: `decide` computes `.veg` (may this column spare vegetation? — §7i), `end_event` arms the `.vclear` after-slope buffer, and `start_event` raises `.retro` (the before-slope retro-clear request), so the two editions cannot disagree about *which* columns clear what. The list of *what counts as vegetation*, by contrast, is **per edition by design**: Java's `#infinite_rail:keep` block tag (`src/java/.../tags/block/keep.json`) and Bedrock's `scripts/vegetation.js` module are independent hand-maintained files — Java tests cells against the tag in commands, Bedrock calls `isVegetation()` in script, and since the editions' block ids and grouping mechanisms differ anyway (vanilla group tags vs typeId fragment matching), each file spells the shared *policy* in its own edition's terms. Keep the pair in sync when changing what the carve spares; the build fails if either file is missing from its pack.

The shared files are **byte-identical on both engines** — the build injects them verbatim (and lints them against the dual-dialect subset), so they can be symlinked from `src/shared/functions/` straight into a dev world. Two conventions make that possible: score holders use the `.` prefix in *both* editions (`#` is a Java-only fake-player convention; `.` is the prefix documented to parse on Bedrock, and Java accepts it just as well), and shared-to-shared function calls use bare **`ir_*` bridge names** instead of an engine-specific path (Java `infinite_rail:name` vs Bedrock `infinite_rail/name`). A bare `function ir_end_event` resolves on Java in the `minecraft` namespace and on Bedrock from the `functions/` root; each edition keeps a one-line trampoline there (`src/java/data/minecraft/function/ir_*.mcfunction`, `src/bedrock/bp/functions/ir_*.mcfunction`) that hops into the real shared file. Three calls are bridged: `ir_consider_start`, `ir_start_event`, `ir_end_event`. A live tweak is the *same command* on both editions: `/scoreboard players set .HOVER ir 8`.

**Native per edition (same job, different machinery):** everything that touches the engine. Java's implementations are described in §6–§7; Bedrock's counterparts all live in `src/bedrock/scripts/main.js` (stable `@minecraft/server` Script API — no experiments, no betas):

| Job | Java mechanism (kept) | Bedrock mechanism (replaces it) |
| --- | --- | --- |
| Heightmap sampling | `ir_probe` marker + `execute positioned over motion_blocking_no_leaves` | `dimension.getTopmostBlock()` + a short walk down past leaves/foliage + a climb back up any liquid column — Bedrock's topmost-block probe **skips liquids**, so an ocean read lands on the sea *floor*; the climb restores Java's liquids-count-as-surface semantics, so oceans read as sea level and get bridged instead of dived into. Reads are memoized per column (the sliding window re-samples each X twelve times) |
| Near-ground scan (slope timing, §7j) | `near_scan`/`near_step` — a probe recursion at odd offsets +1, +3, … pairing consecutive reads (min — tree trunks vanish) and folding them into `.gfloor`/`.gmax`/`.gcone` with scoreboard max operations | `nearScan()` — the same odd-offset pair loop over the memoized `surfaceY()` reads (the 48-block window already fills the memo, so the scan costs no extra real probes) |
| Track history | storage `infinite_rail:track y` list + `cam_get` macro (NBT paths need literal indices) | a plain JS array (`trackY`), trimmed behind the ride and persisted (below) |
| The build loop | `build_loop` ⇄ `build_step` bounded recursion (mcfunction has no loops) | a `while` loop with the same `.budget` / `.AHEAD` conditions |
| Camera math | fixed-point milliblock scoreboard arithmetic (`cam_follow`/`cam_blend`/`cam_scan`/`cam_sample`) | the same construction in ordinary floating point (`camFollow()` / `lifted()`) |
| Moving the rig | `ir_seat` item_display with `teleport_duration:1` + `cam_tp` macro (client-interpolated teleports) | `ir_seat` **custom entity** (this pack's BP+RP: invisible, no gravity, no collision) that the ride cart rides as a passenger, moved by per-tick **velocity drive** (`clearVelocity` + `applyImpulse`; Bedrock clients interpolate physics motion, not teleports), with a teleport fallback for drift |
| The pace | hidden `ir_cart` on the physical rails + `ir_plug` + stall keeper + the minecart max-speed gamerule | a **virtual pace position** (`paceX`) advanced by scripted speed with smooth acceleration — no entity, no keepers, nothing visible behind the rider |
| Ocean detection | `execute if biome ~ ~ ~ #minecraft:is_ocean` | `dimension.getBiome()` against an explicit ocean-id set (Bedrock has no biome tags) |
| Chunk management | `forceload` macro corridor | an invisible **chunk scout** entity carrying vanilla's `minecraft:tick_world` component (radius 6 chunks = a 96-block ticking bubble, `never_despawn` — the ender dragon's own chunk loader), gliding ahead of the rig as a *mobile ticking area*. Its post is derived from `.AHEAD` so the bubble covers a full-gap head's **entire 48-block sample window** (~120 blocks ahead of the rig at defaults), capped so the bubble always overlaps the rider's own simulation bubble (no coverage hole the head couldn't cross). `/tickingarea` is unusable for this job: it neither generates new terrain nor pre-loads it (measured in-game — a 470-block corridor of areas contributed zero loaded chunks) |
| Column placement | `place_flat/up/down` + the vegetation-sparing `carve`/`carve_layer` (per-cell `unless block … #infinite_rail:keep`) + `support` | `fillBlocks` + per-cell `isVegetation()` checks (from Bedrock's own `scripts/vegetation.js`) + `setBlockPermutation` (`golden_rail` `rail_direction` 1/2/3, the custom `infinite_rail:support` power block, `light_block_11`) |
| Start/stop entry | `/function infinite_rail:start` | `/function infinite_rail/start` — a one-line function bridging into the script via `/scriptevent` |
| Ride modes: rain / night (§6.9) | `set_rule` macro + version-picked names from `names.mcfunction` | plain lowercase gamerule literals in the `mode_*` function files (Bedrock's names are stable) — no script involvement |
| Ride modes: sky speed & ocean pause | `sky_speed` at toggle/begin + an early `return` in `ocean_check` | `tickPace()` asserts `.SKYSPEED` every tick while `.SKYMODE` is on (and resets the ocean state on the toggle-off transition); `oceanCheck()` returns early — both read the score through the same bridge as the brain flags, so cmd-bridge worlds keep working |
| Ride modes: torch scatter | `place_torch`/`torch_at`/`torch_try` (`/random` rolls + a macro'd Z offset + `positioned over` heightmap + `setblock … keep`), with `forceload_here` widening the corridor to `.TORCHRANGE` | `maybeTorch()` (Math.random + the surface probe + per-cell air/solid checks), called from `advance()` — the scout bubble already covers ±96 blocks, so no corridor change |
| Ride modes: the Settings menu | a **written book** pinned by `give_menu` after each per-tick inventory clear — clickable `[On]`/`[Off]` `click_event`s that `/trigger` the `ir_menu` objective, dispatched to the mode functions by `menu_tick` (permission-free: no operator, no 1.21.6+ confirmation screen) | a plain named book pinned by the inventory keeper; using it fires `itemUse` and the script shows a native `@minecraft/server-ui` **ModalForm** of toggles pre-set from the live scores, applying only actual changes by running the same `mode_*` files |
| World tuning | `setup_world` (camelCase) + overlay (snake_case) | `setup_world` (Bedrock's lowercase gamerule names) — a third small file, same rules |

### 11b. The Bedrock rig and camera

The rig is three pieces like Java's, but with **exactly one mount in the whole system**: the rider sits on the invisible **camera seat** (seat offset 0.35 up), and the **minecart-look cart prop** (tag `ir_ride`) is *not mounted on anything* — `cam_move` glides seat and cart **independently, in lockstep**, with the same velocity drive toward the same target each tick. Java stacks seat → cart → player instead; Bedrock cannot, for two hard-won reasons: mount *state* is not reliably queryable there (the `minecraft:riding` component and `rideable.getRiders()` both under-report, which turned a "re-mount if unseated" keeper into a per-tick mount war — pose flicker, mount-sound spam), and the engine proved unwilling to keep an *entity* passenger seated at all — the cart kept being ejected within ticks of a successful `addRider` and parked at the dismount spot above the rider's head. Player-on-seat is the one mount Bedrock keeps stable, so it is the only one used. The seat is a tiny custom entity (`infinite_rail:seat`: no gravity, no collision, one player seat). The **cart is a custom entity too** (`infinite_rail:cart`): its client definition uses a re-based copy of the vanilla minecart geometry (`geometry.ir_cart` — every cube shifted 16px down, because the vanilla model draws a block high outside the engine's internal minecart renderer) with the vanilla minecart texture, so it looks like a real cart, but it carries none of the minecart's client-side behavior — which matters because Bedrock clients tilt a *real* minecart's model 45° whenever it occupies a block cell containing an ascending rail, even off-rail; the rig glides right along the track line, so at slope entries/exits a real ride cart visibly flickered between tilted and flat. The prop has **no `rideable` component and no `health`** — nothing can ever enter it, and Bedrock's mount-health HUD (which showed as rows of hearts over the food bar for a 100-HP vehicle) never appears. A vanilla minecart remains the spawn fallback for an outdated BP. The cart being the seat's *passenger* is load-bearing — passengers run no physics of their own, so the engine's minecart logic (capture onto the powered rail in the cart's own block cell, gravity, ground contact) can never fight the script for control of the cart; that fight is exactly what made a directly-driven cart visibly bob up and down. The script computes the same smoothed height `sy` as Java (§7g, float port) and glides the seat toward `(paceX + .CAMAHEAD, sy + 0.062 + .CAMHEIGHT/10, centerZ + 0.5)` by setting its velocity each tick; the client renders that as smooth motion, and the player's normal first-person camera rides along — **full native free-look with zero added latency**, the same experience as Java.

Why not the `/camera` (Camera API) rig by default? Bedrock's `minecraft:free` preset **does not follow look input** — the official camera-system docs state input keeps rotating the *player*, not the detached camera. A Camera-API rig therefore needs the script to pass `player.getRotation()` back into `setCamera` every tick, which adds a perceptible beat of look latency. That trade is available as **`.CAMMODE 1`** (cinematic mode): the view detaches onto `minecraft:free` at eye height above the cart, eased ~0.15 s Linear per tick for extra positional glide, rotation passed through from the player. `.CAMMODE 0` (default) keeps the native camera.

Keepers (the Bedrock subset of §7f): strangers are ejected from the seat; a dismounted rider (survival mode, or adventure from a pre-survival save) is re-seated; the rig is re-summoned if it ever goes missing; the rider's inventory is cleared every tick (so nothing is ever held); and while `.HIDEHAND` is on, an invisibility effect on the rider is re-asserted once a second — Bedrock's `/hud` has no `hand` element, and invisibility is the one vanilla mechanism that reaches the first-person arm — at the cost of the rider's body also being hidden in third-person/F5 too).
**The rider re-mount decision is positional, never API-queried**: a seated player is pinned to the seat while the rig glides east at cruising speed, so a genuine dismount shows up as distance from the seat that keeps growing tick after tick — only a sustained streak (`ASTRAY_TICKS`) triggers a re-mount. The riding component and the rider list both under-report on Bedrock, and re-mounting an already-seated passenger re-fires the mount (the pose-flicker war described above), so neither is ever trusted for mount state. The cart prop needs no keeper at all — `cam_move` owns its motion. The plug, stall re-boost, and pace-cart ejections have no Bedrock equivalent because the virtual pace made them obsolete.

### 11c. Speed without the gamerule

Bedrock has no minecart max-speed gamerule, so `.MAXSPEED`/`.OCEANSPEED` steer the **virtual pace speed** directly: `ocean_check`'s shared trigger logic (same per-chunk cadence, same `.OCEANCHUNKS`/`.LANDCHUNKS` hysteresis, sampled at the rider) sets a target speed in blocks/tick, and the pace gains or sheds 0.4 blocks/s of speed per tick (the default 8 → 32 ocean ramp takes ~3 s) — reproducing the gradual physics acceleration the Java cart gets from its rails. Consequently `.MAXSPEED` is *continuously* honored on Bedrock (tweak it live and the ride adjusts within seconds), whereas Java applies it once at start via the gamerule.

### 11d. State & persistence

The shared brain's state (`.slope`, `.flat`, `.lastDir`, all config) lives in the scoreboard, which Bedrock persists in the world save exactly like Java. The script's own state (headX, railY, centerZ, avg, the pace position and speed, the ocean counters, the descent chaser, the rider's name, and the last 1024 columns of track history) is saved to a world **dynamic property** (`ir:state`, a few KB of JSON) every 2 seconds and on every lifecycle change — so a Bedrock ride **survives quitting and rejoining the world**, resuming where it left off. `.autodone` lives there too, so auto-start stays once-per-world across rejoins. The in-memory history is trimmed to the last ~2048 columns (the camera only reads a few hundred around the rig), so an endless ride can't grow memory forever — unlike Java's storage list (§9), which is unbounded by design.

### 11e. Bedrock-specific behavior differences & gotchas

- **The support is a custom block, not a disguised redstone block.** Bedrock has no `block_display` entities, so instead of Java's disguise-over-power two-parter the port defines `infinite_rail:support` (BP `blocks/support.json`): a full cube rendered with the **vanilla smooth-stone texture** (the RP's `terrain_texture.json` maps a shortname onto vanilla's `textures/blocks/stone_slab_top` — no texture is shipped) that carries **`minecraft:redstone_producer`** at power 15 (`strongly_powered_face: up`), so it powers the rail exactly like a block of redstone. Water immunity and zero light emission are the same as the redstone block it replaces; the script falls back to a bare `minecraft:redstone_block` if the custom block fails to resolve (outdated BP). Track built by older pack versions keeps its redstone blocks.
- **Requires Bedrock 1.21.120+** (`@minecraft/server` module `2.3.0`, `min_engine_version [1,21,120]` — `dimension.getBiome` and the `minecraft:redstone_producer` block component, both 1.21.120-era, are the gates). Both pins can be raised freely for newer-only targets.
- **Rails are decorative for physics.** No entity rides the physical rails on Bedrock (the pace is virtual, the ride cart is velocity-driven), but the track is still built from genuinely powered golden rails on redstone blocks, so it works for manual minecart rides after `stop`.
- **`/reload` reloads both functions and scripts** on Bedrock; the script re-initializes lazily and resumes the ride from its persisted state. Editing `config.mcfunction` + `/reload` refreshes knobs mid-ride, same as Java.
- **Only players generate terrain on Bedrock.** There is no working equivalent of Java's `forceload`-driven generation: `/tickingarea` keeps already-active chunks ticking but generates and pre-loads *nothing* (two corridor designs built on it failed identically — the builder crawled along the rider's own simulation bubble, building in bursts right in front of the cart). The pack's answer is the **chunk scout** (`infinite_rail:scout`): an invisible entity whose vanilla `minecraft:tick_world` component makes it a mobile 6-chunk ticking area. It glides ahead of the rig — stepping only onto ground whose chunk is already open, so it can never strand itself — and between the rider's bubble and the scout's, the corridor from the rig to ~`.AHEAD` blocks past the pace stays loaded and script-readable. How far terrain actually *generates* ahead is governed by the rider's **render distance** (the scout can only hold open what the engine has generated), which therefore needs to comfortably cover the corridor — ~20–24 chunks at the default `.AHEAD`; anything much higher just makes the generator churn forever behind a ride that never builds past `.AHEAD` anyway.
- **"Loaded" and "ticking" are different states at the bubble's edge.** In the border ring around a ticking area, block lookups can succeed and hand back a `Block` whose *property reads* then throw `LocationInUnloadedChunkError`. The surface probe is therefore wrapped whole: any throw anywhere inside it reads as "no data at this column yet" and the sample falls back to the rolling average, instead of aborting the column (which used to stall the head at full gap and spam build errors).
- **The scout is a real simulation load**: its 13×13-chunk bubble ticks like an extra player at simulation distance ~6 (mob spawning included). This is the price of far-ahead building. The world's own simulation distance can (and should) stay at 4 — it contributes nothing to the ride anymore, and every notch above 4 ticks hundreds of additional chunks around the rider for nothing.
- **The builder tolerates a lagging frontier.** A column needs only its own chunk plus a one-chunk margin (`BUILD_MARGIN`, 17 blocks — at least 4 of the 12 window samples) loaded to build; missing far samples fall back to the rolling average *individually* (`badSamples` in the debug line). The guard exists to prevent deciding columns with **zero** real samples (which would freeze the average and bake a flat line into the world) — requiring the entire 48-block window, as the port originally did, pinned the head ~49 blocks behind the frontier and caused the bursty, build-only-when-close behavior. While the builder is starved anyway, the pace **eases off smoothly** (the allowed speed shrinks with the remaining track buffer) rather than letting the ride outrun the track. If starvation persists, a one-time chat warning points at debug mode (`/function infinite_rail/debug`), which reports the loaded frontier, the scout's lead over the head, and the algorithm's live numbers (`badSamples`, `avg`, `railY`) every 16 blocks.
- **The scoreboard bridge self-heals.** The startup self-test verifies that API-written scores are visible to commands; if a version splits the two scoreboards, the script switches to a command-based bridge (inputs via `/scoreboard`, the brain's answer read back through execute-if-score successCount probes) and says so. In that mode live `.KNOB` tweaks read as config defaults.
- **Distribution is a single `.mcaddon`** (behavior pack + the small resource pack holding the invisible client definitions of the seat and scout entities); the BP's manifest depends on the RP, so activating the BP pulls the RP in automatically.
- **A startup self-test** exercises the script↔command scoreboard bridge and the shared `decide` function once per load (when no ride is active) and reports loudly and specifically if either leg is broken, instead of letting the ride degrade into a silent flat line.
- **Rig integrity is self-healing**: duplicate seats/carts/scouts from rejoin races are removed on sight, a missing rig piece gets a 2-second grace period (so a merely-still-loading original isn't duplicated) before the rig is rebuilt, a missing scout is respawned at the rig (the one spot the rider guarantees is loaded) and walks itself back to its post, and the ride freezes entirely while its rider is offline.
- **The rider is in survival mode, not adventure.** Bedrock does not naturally spawn mobs around adventure-mode players (Java's spawning ignores game mode), which left the whole ride lifeless — no animals, no monsters. Survival restores normal spawning; the rider stays untouchable through Resistance 255 + the damage gamerules, `mobGriefing false` protects the track, the per-tick inventory clear leaves nothing to place or swing, and neither rig piece can be entered. Old saves whose rider is still in adventure resume fine (the keeper accepts both modes).
- **The first-person arm is hidden via invisibility** (`.HIDEHAND`, default on): `/hud` cannot touch the hand, so the keeper keeps an invisibility effect on the rider — with the inventory always empty, nothing renders. Costs the rider's own third-person/F5 body; set `.HIDEHAND 0` to opt out. `stop` clears it with the other effects.
- **Single scripted rider:** the ride belongs to the player who started it (or the first player, on auto-start); only that player is re-seated by the keeper. Leave the ride the sanctioned way — switch to creative or run `stop` — exactly like Java.
- **Ride modes are score-driven on the Bedrock side too.** The `mode_*` functions only run commands and flip `.RAINMODE`/`.NIGHTMODE`/`.TORCHMODE`/ `.SKYMODE`; the script never needs a scriptevent for them. It reads `.SKYMODE` and `.TORCHMODE` through the same bridge as the brain flags (native API normally, successCount probes cached ~1 s on cmd-bridge worlds), asserts `.SKYSPEED` each tick while sky mode is on, resets the ocean counters on the sky-off transition, and plants torch-mode torches from `maybeTorch()` in the column builder. Rain/night use Bedrock's stable lowercase gamerule names directly in the function files.
- **The Settings book opens a native form.** The inventory keeper pins a plain book named "Settings" into the last hotbar slot instead of clearing that slot (deliberately *not* slot-locked — `ItemLockMode` items get a lock badge and a "Can't be moved/dropped/…" tooltip block, and the per-tick keeper makes the lock redundant anyway); using it fires `world.afterEvents.itemUse`, matched by item type + name + rider, and the script shows a `@minecraft/server-ui` **ModalFormData** — one toggle per mode pre-set from the live scores, an Apply button, and only actual changes run their `mode_*` function (so the tellraw feedback matches the chat commands exactly). The BP manifest therefore depends on `@minecraft/server-ui` `2.0.0` (stable long before the pack's 1.21.120 floor). `stop` removes the book.
