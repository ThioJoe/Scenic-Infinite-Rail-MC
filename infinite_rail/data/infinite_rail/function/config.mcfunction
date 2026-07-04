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
# Keep it at least 2: the redstone power block under the rail is immune to
# water, but the rail itself is not, so the track must stay above sea level.
scoreboard players set #HOVER ir 2


# --- Smooth camera (hybrid) --------------------------------------------------
# On flat track the rider sits in the REAL minecart -- native feel, perfectly
# in sync with the cart model. Around every elevation change they are switched
# (seamlessly, at identical eye height) onto an invisible gliding "camera
# seat" that follows the cart's X/Z exactly -- the cart always sets the pace,
# however fast the rails push it -- while its height flies a pre-smoothed
# S-curve computed from the track's own recorded profile. Climbs begin rising
# BEFORE the corner and the camera never drops below the rail line; descents
# use a reactive exponential glide. Once the track is flat again the rider is
# handed back to the real cart.

# EXTRA camera height above the normal in-cart seating position, in TENTHS of
# a block. 0 = exactly the view you'd have sitting in the cart (recommended).
# Keep it small (<= ~5) so climb corners can't lift your head into tunnel
# roofs.
scoreboard players set #CAMHEIGHT ir 0

# How far (in blocks, each side of the cart, even numbers only) the camera
# looks along the recorded track profile. This is the S-curve reach: climbs
# start rising about this many blocks before the slope and the camera floats
# up to ~1/4 of this above the cart while cresting into one (capped at 2
# blocks). Bigger = softer, earlier, floatier transitions; smaller = tighter.
# 0 disables the camera system entirely (pure cart riding).
scoreboard players set #CAMWINDOW ir 8

# Descent glide: each tick the camera closes 1/N of the remaining gap when its
# target is BELOW it (drops into valleys, easing out after a crest). Climbs
# are not affected -- they're pre-smoothed by the window above and follow with
# zero lag, so they can never sag into the cart or the ground. 1 = off.
scoreboard players set #CAMSMOOTH ir 4


# --- Auto-start -------------------------------------------------------------

# 1 = the ride starts by itself for the first player to appear in a fresh
# world -- no command needed. It only ever auto-starts once per world, and
# stopping with /function infinite_rail:stop stays stopped across rejoins.
# 0 = classic manual start via /function infinite_rail:start.
scoreboard players set #AUTOSTART ir 1


# --- Slope shaping (the "event" model) -------------------------------------
# Every elevation change is a single continuous 45-degree line ("event") that
# runs until it reaches the target height, then the rail goes flat. These
# control how large and how frequent those changes are. Now that the smooth
# camera irons out every flat->slope corner, the track can afford smaller,
# more frequent elevation changes than the old 50/50 gaps -- the line hugs the
# scenery closer and the rider never feels a single corner.

# Minimum height difference (in blocks) before a new climb/descent is started.
# Also acts as hysteresis, so small terrain noise never nudges the rail.
scoreboard players set #DEADBAND ir 2

# Minimum flat blocks between two changes in the SAME direction.
# Higher = fewer, longer swoops. Terrain that rises faster than this allows
# gets tunneled through instead of climbed.
scoreboard players set #SAMEGAP ir 5

# Minimum flat blocks required before the rail may REVERSE direction.
# Higher = no quick up-then-down bobbing; small bumps get tunneled through and
# small dips get bridged across.
scoreboard players set #TURNGAP ir 40


# --- Terrain-smoothing sensitivity -----------------------------------------
# Per-column limits on how far a single lookahead sample may pull the rolling
# average up or down.

# Larger = approaching mountains raise the target sooner (earlier, gentler
# "one swoop" climbs).
scoreboard players set #UPCLAMP ir 75

# Smaller = ravines, holes and canyons are ignored and bridged dead level
# instead of dipped into.
scoreboard players set #DOWNCLAMP ir 25


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
