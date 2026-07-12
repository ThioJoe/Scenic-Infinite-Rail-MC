# CONTEXT.md Summary:

A complete technical reference for the project: the architecture, the shared state, every file, and the algorithms. Written for a developer (or an AI) who needs to understand or modify the pack. For the repository layout and build workflow see `BUILDING.md`. After changing the algorithm or any file this document describes, verify with the integration tests — see `tests/README.md` for how to run them, what they cover, and how to add new ones for whatever you just changed.

Sections 1–10 document the **Java Edition** data pack (the original and richest implementation); **section 11** documents the **Bedrock Edition** port and how the two editions share one codebase.


---

The layout of the CONTEXT.md is markdown, with top level headers appearing as for example:
## 1. What it is

And 2nd level headers as:
### 4.3 Command storage
### 7d. Power & the disguise

Therefore you can use regex to fetch specific sections.

---

# CONTEXT.md Table of Contents: Scenic Infinite Rail Mode

- 1. What it is
- 2. Data pack anatomy & how Minecraft bootstraps it
- 3. Coordinate & geometry conventions
- 4. Shared state
  - 4.1 The scoreboard objectives
  - 4.2 Entities (all tagged, so selectors are unambiguous)
  - 4.3 Command storage
- 5. Runtime flow (the big picture)
- 6. File-by-file reference
  - 6.1 Metadata & vanilla hooks
  - 6.2 Initialization & config
  - 6.3 Lifecycle / control
  - 6.4 The build loop
  - 6.5 Terrain sampling & the slope decision (the algorithm)
  - 6.6 Column geometry (how slopes map to blocks)
  - 6.7 Chunk management
  - 6.8 Smooth camera (the ride rig)
  - 6.9 Ride modes
  - 6.10 Ride speed & the debug tools
- 7. The algorithms in depth
  - 7a. Terrain-surface sampling → rolling average
  - 7b. The event model (slope shaping)
  - 7c. Column geometry (how slopes map to blocks)
  - 7d. Power & the disguise
  - 7e. Chunk loading / unloading
  - 7f. The keepers
  - 7g. The smooth camera (the ride rig)
  - 7h. The ocean speed-up
  - 7i. Vegetation-sparing clearing
  - 7j. Ground-hugging slope timing (the near scan)
  - 7k. The big-event gap credit
  - 7l. The stretch shift (descents)
- 8. Tuning
- 9. Limitations & gotchas
- 10. Quick map (function → what calls it)
- 11. The Bedrock Edition port & the shared codebase
  - 11a. The logic boundary: what is shared and what is native
  - 11b. The Bedrock rig and camera
  - 11c. Speed without the gamerule
  - 11d. State & persistence
  - 11e. Bedrock-specific behavior differences & gotchas