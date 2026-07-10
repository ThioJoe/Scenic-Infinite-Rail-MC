# Building Scenic Infinite Rail Mode

One repository produces two packs: a **Java Edition data pack** and a **Bedrock Edition behavior pack**. Nothing in `src/` is playable directly — the build assembles the shippable packs from three source folders.

```
src/
  shared/functions/     .mcfunction files used VERBATIM by both editions:
                        the event-model brain (decide, consider_start,
                        start_event, end_event), config (every tunable),
                        modes_init (mode-toggle + ride-speed seeding),
                        consts (fixed cross-edition constants, e.g. the
                        Speed items' .SPEEDSTEP increment), speed_step (the
                        adjustable ride speed's state machine) and
                        debug_state (the live-state sidebar mirror)
  java/                 the Java data pack, minus the shared files
                        (pack.mcmeta, data/, overlay_snake/ -- including the
                        ir_* call bridges in data/minecraft/function/ and the
                        carve's vegetation list, tags/block/keep.json)
  bedrock/bp/           the Bedrock behavior pack, minus the shared files
                        (manifest.json, functions/ -- including the ir_* call
                        bridges at its root -- scripts/ -- including the
                        carve's vegetation list, vegetation.js -- entities/,
                        blocks/, items/ -- the non-placeable Speed -/Reset/+
                        hotbar items)
  bedrock/rp/           the Bedrock resource pack: the invisible client
                        definitions of the camera-seat and chunk-scout
                        entities, plus the texture/sound/name wiring for the
                        custom track-support block and the Speed items'
                        icons (all reuse vanilla textures -- no image files
                        are shipped)
tools/
  build.mjs             assembles + validates + zips both packs (zero deps)
  simulate.mjs          interprets the emitted shared functions and asserts
                        the algorithm's invariants (CI runs this)
```

## Build

Requires Node.js 18+ (no npm packages):

```
node tools/build.mjs node tools/simulate.mjs   # optional but recommended: logic regression test
```

Outputs, all under `dist/` (gitignored):

| Output | What to do with it |
| ------ | ------------------ |
| `dist/java/Scenic_Infinite_Rail_Mode/` | Drop the folder into a world's `datapacks/` folder |
| `dist/ScenicInfiniteRailMode-Java-v*.zip` | Or drag this zip onto the Data Packs screen |
| `dist/bedrock/Scenic_Infinite_Rail_Mode_BP/` | The behavior pack as a folder (for `development_behavior_packs`) |
| `dist/bedrock/Scenic_Infinite_Rail_Mode_RP/` | The resource pack as a folder (for `development_resource_packs`) |
| `dist/ScenicInfiniteRailMode-Bedrock-v*.mcaddon` | Double-click to import into Bedrock (BP + RP in one file) |

GitHub Actions runs the same two commands on every push and uploads three artifacts, each suffixed with the run number so successive test builds are easy to tell apart: `ScenicInfiniteRailMode-Java-N` (the datapack folder), `ScenicInfiniteRailMode-Bedrock-N` (the `.mcaddon`), and `ScenicInfiniteRailMode-Bedrock-Folder-N` (the unzipped BP + RP folders, for dropping straight into `development_behavior_packs` / `development_resource_packs` while testing). Pushing a `v*` tag attaches the `.zip` + `.mcaddon` to a GitHub release. The release version comes from `header.version` in `src/bedrock/bp/manifest.json` (the RP manifest and the BP's RP-dependency entry must carry the same version; the build enforces this).

## How sharing works (and its limits)

The philosophy is **share the decisions, keep the data-work native**:

- The *brain* — the event model that turns "the terrain wants elevation X" into "this column is flat / climbing / descending" — is pure scoreboard math. It lives once, in `src/shared/functions/`, and runs as `.mcfunction` on both engines. Each engine boils its world down to six integers (`.target`, `.railY`, the near-ground scan's `.gfloor`/`.gmax`/`.gcone` — the slope-timing guards' inputs — and the stretch-shift scan's `.sver`), calls `decide`, and reads back one integer (`.dir`) plus the carve-mode flags (`.veg`, `.retro` — which columns may spare vegetation, and when to retro-clear before a slope).
- The *vegetation list* — what the carve spares — is **per edition**: Java's `#infinite_rail:keep` tag (`src/java/data/infinite_rail/tags/block/keep.json`) and Bedrock's `src/bedrock/bp/scripts/vegetation.js` (`isVegetation()`). It can't be a shared *function file* (Java tests blocks with a block tag in commands; Bedrock commands have no block tags, so its checks run in script), and the editions' block ids and grouping mechanisms differ anyway, so each file is maintained by hand in its edition's own terms — keep the two in policy sync. The build fails if either is missing from its assembled pack.
- Everything that touches the engine — terrain sampling, block placement, chunk loading, entities, the camera — is implemented natively per edition: Java keeps its `.mcfunction` machinery (`sample_window`, `cam_*`, macros, storage), Bedrock does the same jobs in `scripts/main.js` with the Script API. Neither edition emulates the other's workarounds.

Shared files must parse on **both** command engines — *byte-identical*, no build-time rewriting — so `tools/build.mjs` lints them against a strict dual-dialect subset — comments, `scoreboard players set/add/remove/operation/reset`, `execute if|unless score ... run`, and bare-name `function ir_<name>` bridge calls. No selectors, coordinates, NBT/storage, macros, `execute store`, namespaced ids (`:` or `/` in a command — the scoreboard divide operator ` /= ` is the one permitted `/`, it parses on both engines), or `#`-prefixed score holders (those all differ between engines and belong in `src/java` or `src/bedrock`). The build fails loudly if a shared file drifts outside the subset, and injects the files into both packs verbatim. Because the copies are identical, the files in `src/shared/functions/` can be **symlinked directly** into a dev world's pack for live editing.

Two conventions make the identical-copy guarantee possible — this replaces the old build-time dialect rewriting:

1. **Score holders use the `.` prefix everywhere.** `#NAME` fake players are a Java-only convention (Bedrock's parser rejects `#`); `.`-prefixed fake players parse on both engines, so *both* editions now use `.HOVER`, `.slope`, `.dir`, … — same variables, same objectives (runtime state in `ir`, the tunables in the three sidebar-sized groups `cfg_terrain`/`cfg_camera`/`cfg_ride` — see CONTEXT.md §4.1), same spelling. Live-tweaking from chat is identical on both editions: `/scoreboard players set .HOVER cfg_terrain 8`.
2. **Shared-to-shared function calls go through bare-name bridges.** Java spells a function path `infinite_rail:end_event`, Bedrock spells it `infinite_rail/end_event` — so shared files spell neither. They call the bare name `ir_end_event`, the one function-call form both engines accept: Java resolves it in the `minecraft` namespace, Bedrock from the `functions/` root, and each edition supplies a one-line trampoline there (`src/java/data/minecraft/function/ir_*.mcfunction`, `src/bedrock/bp/functions/ir_*.mcfunction`) that hops into the real shared file. Three calls are bridged this way: `ir_consider_start`, `ir_start_event`, `ir_end_event`. The assembled-pack validation checks every bridge resolves on both sides.

`tools/simulate.mjs` guards the whole arrangement: it interprets the **emitted** Java and Bedrock copies (each resolved through its own edition's bridges) over eleven synthetic terrains and fails if their decisions ever diverge or the algorithm breaks an invariant (contiguous 45° events, deadband, gap spacing with the big-event gap credit, the climb schedule, the descent floor and runway rules, terrain convergence, the `.veg`/`.retro` carve-mode contract, camera floor/flats/parallel-climb guarantees).

## Adding or changing a function

- **Changing the algorithm's rules** (when to slope, gaps, deadband): edit `src/shared/functions/` — both editions pick it up. Stay inside the dual-dialect subset; the lint will tell you if you don't.
- **Changing which plants the carve spares**: edit **both** vegetation files — `src/java/data/infinite_rail/tags/block/keep.json` (Java vanilla tags + block ids) and `src/bedrock/bp/scripts/vegetation.js` (Bedrock ids + typeId fragment matchers) — they realize the same policy independently per edition.
- **Changing how Java does something** (placement, camera, chunk plumbing): edit `src/java/data/infinite_rail/function/`.
- **Changing how Bedrock does something**: edit `src/bedrock/bp/scripts/main.js` (almost everything lives there), `src/bedrock/bp/functions/` (gamerules, the start/stop command bridges, and the ir_* call-bridge trampolines), or the seat/scout entities' BP/RP definitions (`src/bedrock/bp/entities/*.json`, `src/bedrock/rp/`).
- **Adding a shared-to-shared function call**: call the bare name `ir_<target>` from the shared file, and add the two one-line trampolines — `src/java/data/minecraft/function/ir_<target>.mcfunction` (`function infinite_rail:<target>`) and `src/bedrock/bp/functions/ir_<target>.mcfunction` (`function infinite_rail/<target>`). The build fails if either is missing.
- A file name must not exist in both `src/shared` and an edition folder — the build refuses to let one silently shadow the other.

## Version-support notes

- **Java**: `src/java/pack.mcmeta` declares data-pack formats 82–107 with the `overlay_snake` overlay supplying snake_case gamerule files on 92+. Bump `max_format` (base + overlay) to extend support.
- **Bedrock**: `src/bedrock/bp/manifest.json` pins `@minecraft/server` `2.3.0` (the oldest stable module with every API the script uses — `getBiome` is the gate), `@minecraft/server-ui` `2.0.0` (the settings-menu forms; stable well before the engine floor) and `min_engine_version` `[1, 21, 120]`. Raising them to the current retail pairing is safe whenever older clients stop mattering.
