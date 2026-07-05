# Building Infinite Rail

One repository produces two packs: a **Java Edition data pack** and a
**Bedrock Edition behavior pack**. Nothing in `src/` is playable directly —
the build assembles the shippable packs from three source folders.

```
src/
  shared/functions/     .mcfunction files used VERBATIM by both editions:
                        the event-model brain (decide, consider_start,
                        start_event, end_event), config (every tunable) and
                        modes_init (ride-mode toggle seeding)
  shared/vegetation.js  the vegetation the carve spares -- ONE category list
                        for both editions: the build emits Java's
                        #infinite_rail:keep block tag from it and copies it
                        into the Bedrock pack (scripts/vegetation.js) for
                        runtime isVegetation() checks
  java/                 the Java data pack, minus the shared files
                        (pack.mcmeta, data/, overlay_snake/)
  bedrock/bp/           the Bedrock behavior pack, minus the shared files
                        (manifest.json, functions/, scripts/, entities/,
                        blocks/)
  bedrock/rp/           the Bedrock resource pack: the invisible client
                        definitions of the camera-seat and chunk-scout
                        entities, plus the texture/sound/name wiring for the
                        custom track-support block (which reuses a vanilla
                        texture -- no image files are shipped)
tools/
  build.mjs             assembles + validates + zips both packs (zero deps)
  simulate.mjs          interprets the emitted shared functions and asserts
                        the algorithm's invariants (CI runs this)
```

## Build

Requires Node.js 18+ (no npm packages):

```
node tools/build.mjs
node tools/simulate.mjs   # optional but recommended: logic regression test
```

Outputs, all under `dist/` (gitignored):

| Output | What to do with it |
| ------ | ------------------ |
| `dist/java/infinite_rail/` | Drop the folder into a world's `datapacks/` folder |
| `dist/InfiniteRail-Java-v*.zip` | Or drag this zip onto the Data Packs screen |
| `dist/bedrock/InfiniteRail_BP/` | The behavior pack as a folder (for `development_behavior_packs`) |
| `dist/bedrock/InfiniteRail_RP/` | The resource pack as a folder (for `development_resource_packs`) |
| `dist/InfiniteRail-Bedrock-v*.mcaddon` | Double-click to import into Bedrock (BP + RP in one file) |

GitHub Actions runs the same two commands on every push and uploads three
artifacts, each suffixed with the run number so successive test builds are
easy to tell apart: `InfiniteRail-Java-N` (the datapack folder),
`InfiniteRail-Bedrock-N` (the `.mcaddon`), and `InfiniteRail-Bedrock-Folder-N`
(the unzipped BP + RP folders, for dropping straight into
`development_behavior_packs` / `development_resource_packs` while testing).
Pushing a `v*` tag attaches the `.zip` + `.mcaddon` to a GitHub release. The
release version comes from `header.version` in `src/bedrock/bp/manifest.json`
(the RP manifest and the BP's RP-dependency entry must carry the same
version; the build enforces this).

## How sharing works (and its limits)

The philosophy is **share the decisions, keep the data-work native**:

- The *brain* — the event model that turns "the terrain wants elevation X"
  into "this column is flat / climbing / descending" — is pure scoreboard
  math. It lives once, in `src/shared/functions/`, and runs as `.mcfunction`
  on both engines. Each engine boils its world down to two integers
  (`#target`, `#railY`), calls `decide`, and reads back one integer (`#dir`)
  plus the carve-mode flags (`#veg`, `#retro` — which columns may spare
  vegetation, and when to retro-clear before a slope).
- The *vegetation list* — what the carve spares — is also written once, in
  `src/shared/vegetation.js`. It can't be a shared *function file* (Java
  tests blocks with a block tag in commands; Bedrock commands have no block
  tags, so its checks run in script), so the build derives both editions'
  forms from the one source: Java's `#infinite_rail:keep` tag JSON, and a
  copy of the module inside the Bedrock pack for `isVegetation()`.
- Everything that touches the engine — terrain sampling, block placement,
  chunk loading, entities, the camera — is implemented natively per edition:
  Java keeps its `.mcfunction` machinery (`sample_window`, `cam_*`, macros,
  storage), Bedrock does the same jobs in `scripts/main.js` with the Script
  API. Neither edition emulates the other's workarounds.

Shared files must parse on **both** command engines, so `tools/build.mjs`
lints them against a strict dual-dialect subset — comments, `scoreboard
players set/add/remove/operation/reset`, `execute if|unless score ... run`,
and plain `function infinite_rail:<name>` calls. No selectors, coordinates,
NBT/storage, macros, or `execute store` (those all differ between engines
and belong in `src/java` or `src/bedrock`). The build fails loudly if a
shared file drifts outside the subset.

Two mechanical rewrites are applied to the Bedrock copies at build time —
this is the *entire* per-edition delta of the shared code:

1. `function infinite_rail:name` → `function infinite_rail/name`
   (Bedrock addresses functions by folder path, not namespace).
2. `#NAME` → `.NAME` score holders. The `#` fake-player prefix is a Java
   convention; Bedrock's command parser is only *documented* to accept
   `.`-prefixed fake players, so the Bedrock copies use `.` while Java keeps
   its idiomatic `#`. The rewrite is applied to comment text too (the comment
   marker itself is preserved), so the shipped Bedrock files document Bedrock
   syntax. (Same variables, same objective `ir` — only the prefix differs. If
   you're live-tweaking from chat: `#HOVER` on Java, `.HOVER` on Bedrock.)

`tools/simulate.mjs` guards the whole arrangement: it interprets the
**emitted** Java and Bedrock copies over six synthetic terrains and fails if
their decisions ever diverge or the algorithm breaks an invariant (contiguous
45° events, deadband, gap spacing, terrain convergence, the `#veg`/`#retro`
carve-mode contract, camera floor/flats/parallel-climb guarantees).

## Adding or changing a function

- **Changing the algorithm's rules** (when to slope, gaps, deadband):
  edit `src/shared/functions/` — both editions pick it up. Stay inside the
  dual-dialect subset; the lint will tell you if you don't.
- **Changing which plants the carve spares**: edit `src/shared/vegetation.js`
  (each category carries the Java tags/ids and the Bedrock id matchers side
  by side) — the next build regenerates the Java tag and the Bedrock module.
- **Changing how Java does something** (placement, camera, chunk plumbing):
  edit `src/java/data/infinite_rail/function/`.
- **Changing how Bedrock does something**: edit `src/bedrock/bp/scripts/main.js`
  (almost everything lives there), `src/bedrock/bp/functions/` (gamerules and
  the start/stop command bridges), or the seat/scout entities' BP/RP
  definitions (`src/bedrock/bp/entities/*.json`, `src/bedrock/rp/`).
- A file name must not exist in both `src/shared` and an edition folder —
  the build refuses to let one silently shadow the other.

## Version-support notes

- **Java**: `src/java/pack.mcmeta` declares data-pack formats 82–107 with the
  `overlay_snake` overlay supplying snake_case gamerule files on 92+. Bump
  `max_format` (base + overlay) to extend support.
- **Bedrock**: `src/bedrock/bp/manifest.json` pins `@minecraft/server` `2.3.0`
  (the oldest stable module with every API the script uses — `getBiome` is
  the gate), `@minecraft/server-ui` `2.0.0` (the settings-menu forms; stable
  well before the engine floor) and `min_engine_version` `[1, 21, 120]`.
  Raising them to the current retail pairing is safe whenever older clients
  stop mattering.
