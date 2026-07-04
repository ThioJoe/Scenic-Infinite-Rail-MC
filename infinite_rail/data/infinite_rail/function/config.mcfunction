# =============================================================================
#  INFINITE RAIL - ALL TUNABLE SETTINGS
#
#  This is the only file you need to edit to change the ride's defaults.
#
#  To apply your edits, run  /reload  in chat (or quit and rejoin the world).
#  Minecraft only re-reads .mcfunction files from disk on /reload; it then runs
#  this file automatically, updating a ride already in progress. IMPORTANT:
#  running  /function infinite_rail:config  by itself will NOT pick up file
#  edits -- it just re-runs the copy already loaded in memory. Its only real use
#  is to reset live tweaks (below) back to the values in this file.
#
#  To experiment with ONE value without editing this file, set its score
#  directly in chat, e.g.:   /scoreboard players set #HOVER ir 8
#  Live scoreboard edits take effect on the very next track column, and are
#  reset back to the values below on the next /reload or rejoin.
# =============================================================================


# --- Ride feel -------------------------------------------------------------

# Cruising altitude: how many blocks of clearance the rail keeps above the
# average terrain surface. Higher = a more sweeping, birds-eye view.
# Note: Currently should be at least 2, or else water may destroy the redstone torches
scoreboard players set #HOVER ir 3


# --- Slope shaping (the "event" model) -------------------------------------
# Every elevation change is a single continuous 45-degree line ("event") that
# runs until it reaches the target height, then the rail goes flat. These
# control how large and how frequent those changes are.

# Minimum height difference (in blocks) before a new climb/descent is started.
# Also acts as hysteresis, so small terrain noise never nudges the rail.
scoreboard players set #DEADBAND ir 2

# Minimum flat blocks between two changes in the SAME direction.
# Higher = fewer, longer swoops. Terrain that rises faster than this allows
# gets tunneled through instead of climbed.
scoreboard players set #SAMEGAP ir 75

# Minimum flat blocks required before the rail may REVERSE direction.
# Higher = no quick up-then-down bobbing; small bumps get tunneled through and
# small dips get bridged across.
scoreboard players set #TURNGAP ir 150


# --- Terrain-smoothing sensitivity -----------------------------------------
# Per-column limits on how far a single lookahead sample may pull the rolling
# average up or down.

# Larger = approaching mountains raise the target sooner (earlier, gentler
# "one swoop" climbs).
scoreboard players set #UPCLAMP ir 150

# Smaller = ravines, holes and canyons are ignored and bridged dead level
# instead of dipped into.
scoreboard players set #DOWNCLAMP ir 150


# --- Performance / world generation ----------------------------------------

# How far ahead of the minecart (in blocks) the RAILS are kept built.
scoreboard players set #AHEAD ir 160

# How far ahead of the track head (in blocks) terrain is force-GENERATED, so the
# world exists before the rails reach it. Separate from #AHEAD: rails are built
# #AHEAD ahead of the cart, and chunks are generated #GENAHEAD ahead of the rail
# head -- so terrain exists roughly #AHEAD + #GENAHEAD blocks ahead of the cart.
# Bigger = more generation time (fewer flat "not generated yet" spots if the
# ride outruns world-gen) at the cost of more loaded chunks. Keep it above ~64
# (the heightmap scanner samples 48 blocks past the head).
scoreboard players set #GENAHEAD ir 192

# Maximum track columns built per game tick. Higher = better catch-up if the
# server hitches, at the cost of more work per tick.
scoreboard players set #MAXTICK ir 15
