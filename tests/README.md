# Integration tests — Scenic Infinite Rail Mode

Automated, **zero-dependency** integration tests that run the real packs on real
headless servers (Java + Bedrock) and assert actual game behavior — not just "does it
load", but *does the track stay contiguous, do torches appear only at night, does the
speed land where a click says it should*. The goal: catch silent logic regressions
before anyone has to download a build and ride it by hand.

```
node tests/run.mjs                                   # Java: build from src/ and test that (~5 min)
node tests/run.mjs --pack ScenicInfiniteRailMode-Java_X.zip   # Java: test a CI artifact
node tests/run.mjs --pack dist/java/Scenic_Infinite_Rail_Mode  # Java: test a pack folder
node tests/run.mjs --filter torch                    # only matching suites/tests
node tests/run.mjs --smoke                           # Java: boot suite only ("does the pack load?")
node tests/run.mjs --list                            # show every test, run nothing
node tests/run-bedrock.mjs                           # Bedrock: build BP/RP from src/ (~3 min)
node tests/run-bedrock.mjs --pack Scenic....mcaddon  # Bedrock: test a CI artifact (.mcaddon or the zip wrapping it)
node tests/run-bedrock.mjs --smoke                   # Bedrock: load/init checks only (skip the ride)
```

Exit code `0` = everything passed (skips allowed), `1` = failures; JSON reports land in
`tests/.work/results.json` / `results-bedrock.json` (or `--json <path>`).

## Environment: what must exist before running

The tests need a Java dedicated server and a Bedrock dedicated server already present on
disk. **Just try `node tests/run.mjs` first** — if a server is found it runs immediately;
if not, it prints exactly which paths it checked and exits.

If no server is found, environment provisioning is a **one-time setup step for a human
maintainer** (or a Claude Code environment's *setup hook*, run once when the environment
is created) — not something to run automatically as part of testing. Don't invoke
`tests/setup_headless_env.sh` on your own initiative (it downloads ~300MB from Mojang
and needs specific domains on the network allowlist, listed at the top of the script);
if it looks like the environment simply hasn't been provisioned yet, say so and ask
before running it.

`tests/setup_headless_env.sh` installs:

- **Java 25 JRE** and downloads the **latest Java dedicated server** to
  `~/minecraft_test_env/java_server/server.jar` (and pre-warms the bundler so the first
  test boot is fast)
- the **latest Bedrock Dedicated Server** to `~/minecraft_test_env/bedrock_server/`
- **Node.js 18+** (runs the harness), **gcc** (compiles the IPv6 shim for BDS — see
  quirks), plus `wget unzip curl jq`

The runners auto-detect the servers by checking, in order: `--server-dir`,
`MC_TEST_SERVER_DIR` / `MC_TEST_BEDROCK_DIR`, `$MC_TEST_ENV_DIR/{java,bedrock}_server`,
`~/minecraft_test_env/…`, `<repo>/../minecraft_test_env/…`, and
`/home/user/minecraft_test_env/…`. If none match, they print exactly where they looked.

**The harness owns those server directories.** On every suite it rewrites
`server.properties`, deletes `world/` (Java) or `worlds/` (Bedrock), and deploys the
pack under test. Never keep anything precious in them. No npm packages, no `gh`, no
external tools are used anywhere — even artifact `.zip`s are read by the built-in
extractor (`lib/zip.mjs`).

## How it works (Java)

Each suite gets a **brand-new world** (fixed seed `scenic-rail-tests`) on a freshly
booted server (~13–15 s) with the pack under test deployed, then drives the game over
**RCON** (port 25575, enabled by the harness) and asserts through:

- **Scoreboard readback** — every knob, mode, constant and runtime score.
- **The track history** (`infinite_rail:track y`) — the pack's own recorded profile,
  cross-checked against the **physical world** (`execute if block` on rails/supports/
  lights at the recorded coordinates).
- **Block counting** — torches/sea pickles near fresh track are counted with
  `fill … replace` in the built strip, so "torches silently stopped appearing" or
  "torches appear during the day" is a hard failure, not something to eyeball.
- **Deterministic time** — `tick freeze` / `tick step N` for exact tick control (the
  pack's tick functions obey it), `tick sprint N` to run minutes of game time in
  seconds for endurance checks.

### The surrogate rider

There is no Minecraft client in the loop, and no player. Instead the harness summons an
armor stand and runs `execute as <stand> … run function infinite_rail:begin`. Only the
player-specific steps no-op for a non-player (the recipe toast, the rig summon in
`launch_done`, the mount); **everything else runs exactly as a real ride** — the anchor,
the phased runway pre-build, the pace cart on real rails, the per-tick build loop, chunk
rolling, torch scatter, the track history. The harness then summons the camera rig
(`ir_seat` + `ir_ride`) itself, and the pack's own per-tick keepers glue it together and
fly it — so even `cam_follow` and the ocean check run for real.

What this *cannot* cover: real player join/leave (auto-start countdown, the one-and-only
mount, rejoin re-mounting, hotbar item pinning, the `/trigger` menus, Speed-item
right-clicks). Those need a real client on a protocol-compatible server (protocol
libraries like mineflayer lag behind current versions, and third-party deps are off the
table anyway). The state machines *behind* them (speed_step, menu functions, mode
toggles) are all covered directly.

## The Java suites

| File | Covers |
| ---- | ------ |
| `00-boot` | pack enables, every function compiles, objectives exist, `config`/`consts` values all land on the scoreboard, `modes_init` seeding, `.todok` clock self-test, version-name storage, clean error log |
| `05-version-compat` | does *this* server still accept the gamerule names the pack picked for it — pinpoints silent breakage from Mojang renames (this is what caught 26.2's `block_drops` / `max_command_sequence_length` / `drowning_damage` renames) |
| `10-speed` | the whole speed state machine: ±`.SPEEDSTEP`, the selectable grid through 0 into reverse (no floor), the direction-aware reset (below −default → −default; −default..0 → +default), the gamerule-gets-the-magnitude rule (`speed_push`), reset, gamerule apply, ocean `speed_up`/`speed_down` winner logic |
| `12-reverse` | stop-and-reverse on a live ride: Speed − clicks park the ride at 0 (cart holds still), further clicks run it backwards (cart X decreases, watchdog stays quiet, ocean counters frozen, the reverse chunk roller keeps the cart out of unloaded chunks), the ride parks itself at the start of the remembered track (`rev_check`), and Speed +/Reset head east again — with forward-motion controls making every "it stayed still / went backwards" assert meaningful |
| `13-revcam` | the smooth camera on the Java engine, forward vs reverse (`cam_follow`): a synthetic descent profile driven column by column each way — the seat height must be **identical** in both directions (the stateless symmetric construction, the fix for reverse sinking into descents), never below the rail line, level on flats, and floating ~`.CAMLIFT` above the line mid-descent (not hugging the bare rail — the discriminator against the old chaser) |
| `20-torch` | `torch_auto` night-window boundaries (12541/12542, 23459/23460, day-wrapped clocks), `time_now` predicate bridge, and **physical** torch counts beside fresh track in four mode×time combinations (including the all-important "day + auto ⇒ zero torches") |
| `30-modes` | every toggle & tri-state score, density presets, time modes moving the real clock, sky mode steering an actual ride to exactly `.SKYY` and back down |
| `40-ride` | begin/launch phases under frozen ticks, runway goal, track-history consistency, 45° contiguity, physical rail/support/light spot checks, disguise displays, pace-cart motion, rig distance & height, keeper gluing, `.gap` bounds, `.hdmiss` |
| `41-biglead` | the pace-cart-to-rider lead doubled to 128 (rider pulled to head−96, cart at head−224) on a server pinned to view/simulation distance **2**: the ride still builds and stays healthy, the rig rides ~128 ahead of the cart on loaded chunks, and invisible track + a fast reverse both survive the bigger gap (the strip trailing 128 behind still finds loaded chunks) |
| `42-watchdog` | the pace-cart stop watchdog (`pace_watch`/`pace_fix`), on a server pinned to view/simulation distance **2** (the Java client's Fast-preset render floor — the low-power "TV NUC" shape; the server may clamp internally, whatever it grants is its lowest): hard zero-false-positive asserts across a normal cruise, the first post-launch window, instant 1↔32 speed flaps, Speed-item clicks, sky mode, a hard world pause + slow-motion tick rate, and a full world reload (the disconnect/rejoin edge — including rejoining **while stuck, between checks**: the rescue must fire after resume, never be lost); a 500 blocks/s terrain-outrun torture run; the field repro (builder paused with the head lost — the cart flies off the track end and is pinned there in 3-second hops until building resumes); and the trigger cases — a stone wall across the track, ~70-block lava and water dumps into the bore, the cart+plug killed outright, the cart buried under the track — each must end re-railed, re-plugged, centered on the line and advancing |
| `44-invistrack` | invisible track (`.HIDETRACK`): new columns carry no rail/support but keep their light, pre-toggle track keeps its rails, the just-in-time strip (now a symmetric ±8 window with smooth-stone disguise displays) carries the pace cart across the invisible stretch (placed ahead, wiped behind, zero watchdog rescues), toggle-off restores normal building, and `stop` sweeps the serving strip **and its displays** — with a rail-present control first so the "no rail" probes can't false-pass |
| `45-vegwall` | vegetation & structures are invisible to the slope logic: dense log + planks walls built across the path must not make the line climb (the probe's not-terrain dig-down, end to end) |
| `46-surface` | surface restoration after carving: controlled mounds + `place_flat` straight into them — grass-topped ground regrows grass beside the rails, snow cover comes back as grass + a snow layer, a buried span falls back to its top cell, deep rock and already-open ground stay untouched; and on **invisible track** the CENTER stack is restored too (no support block to hide its floor), with a visible-track control proving the detector reads the right cell |
| `50-longride` | 2 400 ticks of sprinting: sustained building, cart progress, contiguity + physical checks along the whole line, rig still on-profile, no errors |
| `60-lifecycle` | `/reload` mid-ride (state survives, config refreshes, build continues), `stop` teardown (entities gone, forceloads cleared, **track remains**), stopped-stays-stopped, second ride restarts cleanly |
| `90-perf` | **opt-in** (skipped unless `SIRM_PERF=1`): burst-cost measurement around the 16-block chunk roll — `/tick query` percentiles over a live ride, decomposed into fresh-generation vs unload-only vs no-rolls windows. Produces notes, not pass/fail thresholds (numbers are hardware-relative); pin the server to one core (a `java` PATH shim running `exec taskset -c 0 java "$@"`) to simulate a weak device |

## Adding a test

Drop a file in `tests/suites/` named `NN-something.test.mjs` — it is discovered
automatically (files run in name order; the numeric prefix positions it):

```js
import { defineSuite, eq, ok } from '../lib/harness.mjs';
import { startRide, stopRide } from '../lib/ride.mjs';

export default defineSuite('my feature', ({ test }) => {
  test('does the thing', async (ctx) => {
    await startRide(ctx.mc);          // full surrogate ride, launched (.started == 1)
    eq(await ctx.mc.score('.railY', 'ir'), 65, 'anchored where expected');
    ctx.note('anything useful for the report');
    await stopRide(ctx.mc);
  });
  test('slow thing', { timeout: 300000 }, async (ctx) => { /* … */ });
});
```

Tests inside a suite run **in order and share the suite's world** — keep a suite
self-contained, and clean up state you change (modes, density, `.fast`, time) if later
tests in the same suite would see it.

### The `ctx` toolbox

- **`ctx.mc`** (`lib/mc.mjs`) — the game, over RCON:
  - `cmd(str)` — any command, returns the feedback string; `fn(name)` — runs
    `function infinite_rail:<name>`
  - `score(holder, objective)` → int or `null` (unset); `setScore(holder, obj, v)`
  - `storeResult(command)` — `execute store result` into a scratch score and read it
    back (e.g. list lengths)
  - `storageInt/storageString(storage, path)` — NBT storage readback;
    `entityNum(selector, path)`; `entityExists(selector)`
  - `trackLen()` / `trackY(i)` — the track-history list (RCON responses truncate
    around 4 KiB, so **never** `data get` the whole list; these read per-element)
  - `gametime()`, `freeze()`, `unfreeze()`, `step(n)` (needs freeze; waits for
    completion), `sprint(n)` (runs n ticks flat-out, waits)
  - `loadRegion(x1,z1,x2,z2)` / `unloadRegion(…)` — forceload chunks before block
    checks (the ride unloads chunks behind itself; unloaded blocks read as
    `'unloaded'`); `blockIs(x,y,z,block)` → `'match' | 'nomatch' | 'unloaded'`
  - `countAndClearBlocks(x1,y1,z1,x2,y2,z2, block)` — fill-replace counting,
    auto-split under the fill volume limit (destructive; scan after asserting)
- **`ctx.expected`** (`lib/pack.mjs`) — the pack's own `config.mcfunction` /
  `consts.mcfunction` values parsed **from the pack under test**:
  `expected.get('.DEFAULTSPEED')` etc. Assert against these, never hardcoded copies.
- **`ctx.server`** (`lib/server.mjs`) — the process: `log`, `mark()`,
  `errorsSince(mark, {alsoIgnore})` (auth-noise pre-filtered),
  `functionLoadErrors(mark)`.
- **`ctx.state`** — plain object shared between tests of one suite;
  **`ctx.note(msg)`** — attaches info lines to the report.
- **`lib/ride.mjs`** — `placeSurrogate(mc, {x,z})`, `beginRide(mc)`,
  `awaitLaunched(mc)`, `startRide(mc, {x,z})` (all three), `summonRig(mc)`,
  `checkColumn(mc, x, y, z, prevY)` → rail/support/light (pass the previous
  column's recorded Y too: an ascending column's blocks physically sit one
  below its recorded exit height — the check uses `min(prevY, y)`), `stopRide(mc)`,
  `SURROGATE_TAG`.
- **Assertions** (`lib/harness.mjs`) — `eq, neq, ok, between, closeTo, includes,
  fail(msg), skip(reason)`.
- **Suite server options** — `defineSuite(name, { server: { seed: 'x', props: {…},
  javaArgs: […] } }, build)` overrides the world seed / server.properties /
  JVM args for that suite.

### Conventions that keep tests honest

- **Freeze before multi-value consistency reads.** The ride builds between two RCON
  calls; reading `.headX` then `trackLen()` unfrozen *will* flake. Pattern:
  `await mc.freeze(); try { …reads… } finally { await mc.unfreeze(); }`
- **Don't freeze before the launch finishes** (`.started == 2` → 1 is tick-driven), and
  do entity setup (summons/teleports into just-forceloaded chunks) *unfrozen* — chunk +
  entity readiness needs ticks.
- Assert **physical blocks against the recorded profile** (`trackY(i)`), never against
  hardcoded coordinates — terrain is seed-dependent.
- For "X must NOT happen" tests, scan generously (see the day-torch test) — a too-small
  region false-passes. For "X must happen" counts, use tolerant thresholds: the fixed
  seed's spawn is ocean-heavy, so torch tests count torches **plus sea pickles** (the
  over-water fallback).
- Give ride-heavy tests `{ timeout: … }` headroom; `tick sprint` throughput depends on
  world-gen load (~2 400 ticks ≈ 50 s wall here).
- Runs must stay **repeatable with zero manual steps**: no interactive prompts, no
  reliance on leftover state from a previous run.

## Bedrock smoke tests

`tests/run-bedrock.mjs` boots the headless **Bedrock Dedicated Server** with the BP+RP
installed in a fresh world and drives its **console** (BDS has no RCON; commands go via
stdin, responses are scraped from stdout with a quiet-window — see `lib/bedrock.mjs`).
It asserts: clean content log / no script errors, the script's `init()` applied
`config.mcfunction`, `modes_init` seeding, and that the **shared brain files behave
identically on the Bedrock command engine** — the exact `torch_auto` night window, the
full `speed_step` state machine, the mode toggles. Bedrock has no
`scoreboard players get`, so assertions go through `scoreboard players test`
(`server.scoreInRange(holder, obj, min, max)`; `server.scoreValue(...)` bisects that
into an exact value when one is needed).

The suite then runs a **real headless ride** — the Bedrock twin of the Java suites'
surrogate rider (`tests/lib/ride.mjs`): a command tickingarea bootstraps the start
chunks (measured on BDS: tickingareas *do* load and generate their chunks when zero
players are online), an **armor stand** is summoned and the ride is started as it via
`execute as ... run scriptevent infinite_rail:start` (`begin()` accepts any entity;
the player-only comforts — `/ride` by name, gamemode, effects, hotbar, sound — no-op
for a non-player, and the rider-offline freeze tracks the surrogate by entity id).
From there the pack's own ticking-area corridor (which loads and generates its chunks
server-side) keeps the world ready, so the tests can watch
the head advance through the `dbg` mirror (`sidebar_state`), physically verify the
start column (rail + support + light via `testforblock` — note the stand *sinks*, so
over a lake it rests on the floor while the rail rides the water surface + `.HOVER`),
assert no `[Scripting]` errors during the ride, and check `stop` teardown.

To extend it, add an entry to the `tests` array in `run-bedrock.mjs` — helpers on the
server object: `cmd`, `fn(name)` (runs `function infinite_rail/<name>` — note Bedrock's
slash path), `setScore`, `scoreInRange`, `scoreValue`, `scriptErrorsSince(mark)`.

### Container quirks (handled automatically, documented so nobody re-debugs them)

- **No IPv6** ⇒ BDS aborts at boot with a *misleading* `Port [19132] may be in use`.
  The harness detects missing `/proc/net/if_inet6`, compiles `lib/ipv6shim.c` with gcc,
  and `LD_PRELOAD`s it so the v6 bind is faked. Real port collisions are detected
  separately with a clear message.
- **No route to Minecraft services** ⇒ BDS must run `online-mode=false`, and BDS
  *refuses* offline mode while `allowlist.json` exists — the harness deletes it each
  run (and filters the one benign "Error opening allow list file" log line).
- `enable-lan-visibility=false` is set to stop the LAN-announce thread double-binding
  the game port.

## Troubleshooting

- **Suite aborts with ECONNREFUSED to 25575** — the harness already retries RCON for
  ~20 s after boot; if it still fails, a previous Java server is probably alive:
  `pkill -f 'server.jar'`.
- **Bedrock "port in use" with nothing running** — see the IPv6 quirk above; if it's a
  real leftover: `pkill -9 bedrock_server`.
- **`That position is not loaded` / `blockIs` returns `'unloaded'`** — forceload first
  (`mc.loadRegion`); chunks behind the ride get unloaded by `roll_chunks`, and `stop`
  clears all forceloads.
- **A consistency assert is off by a handful of columns** — you read two values from a
  live, still-building ride; freeze around the reads.
- **First Java boot very slow** — the bundler is unpacking `libraries/`; the setup
  script pre-warms this, or just let it finish once.
- **Everything in `05-version-compat` fails after a Minecraft update** — that's the
  suite doing its job: Mojang renamed gamerules again. Check the failure messages, then
  verify candidate names against the server's own registry:
  `java -DbundlerMainClass=net.minecraft.data.Main -jar server.jar --reports --output /tmp/reports`
  → `gamerule` children in `/tmp/reports/reports/commands.json`.
- **`.flok`/`.flwarn` are asserted now**: the forceload macro ends with `return run` on
  its add, so `execute store success … run function` reads the add's real result on
  modern semantics (functions without `return` store 0 — which used to make the health
  signal read "failed" on every ride and fire a bogus warning at start). The ride suite
  asserts `.flok=1` / `.flwarn=0` after a ride. Also, the `minecart_improvements`
  feature the pack declares in `pack.mcmeta` only bakes into a new world's enabled
  features if the pack is enabled *at world creation*, not merely auto-loaded from
  `world/datapacks/` afterward — a pack sitting in the folder shows up in
  `datapack list` as *available* rather than *enabled*, and its `max_minecart_speed`
  gamerule then never appears. `freshWorld` puts the pack in `initial-enabled-packs`
  so world-gen enables it and the improved-minecart physics (the faster, configurable
  cart speed the pace cart rides) is live from the first tick.

## Runtime budget

Full Java run: ~6–8 min (10 suites × ~15 s boot + the sprints). Bedrock: ~3 min
(the shared-brain checks plus the headless surrogate ride).
Suites boot fresh servers sequentially on fixed ports (25565/25575 Java, 19132 Bedrock),
so don't run two harness invocations in parallel on one machine.

## Continuous integration (the public sanity-check run)

The **Integration tests** workflow (`.github/workflows/test.yml`) runs this whole
suite on GitHub's runners, on real Java + Bedrock dedicated servers it provisions
with `setup_headless_env.sh`. It's a separate, slower job from the per-commit
**Build packs** build: it triggers off each build (`workflow_run`) and
**downloads that build's own artifacts**, so a green run confirms the exact
`.zip` / `.mcaddon` a release would ship. (A manually-dispatched run has no
triggering build, so it reuses the most recent build's artifacts — this branch,
else `main` — even from a build that failed only on an un-bumped version;
falling back to a from-source build only if none exist.) It also runs the logic
simulation (`tests/simulate.mjs`). Both editions run even if one fails; the run
is marked failed at the end if either did.

How much it runs is scoped to what the commit changed, to avoid booting servers
for nothing:

- **full** — any `src/` / `tests/` / build-tool change: the simulation + every
  Java suite + the full Bedrock suite.
- **smoke** — a metadata-only change (`manifest.json` / `pack.mcmeta` / pack
  icons): `run.mjs --smoke` + `run-bedrock.mjs --smoke`, the boot-only "does the
  server still load & initialize the pack" checks.
- **skipped** — only docs / license / `.gitignore` / assets changed.

> **This CI run does not replace running the tests yourself.** It exists as a
> public record and a final confirmation that the suite really passes on the
> shipped artifacts — not as a reason to defer testing. Keep running the
> relevant suites locally as you work on a change (that's what catches a
> regression *before* it's committed); the workflow just double-checks the
> result after the fact. Because it uses `workflow_run`, GitHub only honors the
> copy of `test.yml` on the default branch, so it starts firing once that file
> reaches `main`.
