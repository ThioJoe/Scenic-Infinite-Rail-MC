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

# How high (in blocks above the rail) each column's clearance bore is carved --
# i.e. the tunnel/headroom height. Slope columns automatically carve one block
# taller. Keep it at least 3 (the tunnel light sits at rail+3). Bigger = airier
# tunnels and cuttings at the cost of more blocks changed per column.
scoreboard players set #TUNNEL ir 6


# --- Smooth camera (the ride rig) --------------------------------------------
# The rider sits -- mounted once, never remounted -- in a real minecart that
# is glued to an invisible interpolated "camera seat", gliding OFF the rails
# along a pre-smoothed S-curve computed from the track's recorded profile:
# climbs begin rising BEFORE the corner, steady 45-degree runs are followed
# exactly parallel with zero lag, and descents use a reactive exponential
# glide. The camera never drops below the rail line. Meanwhile a hidden
# "pace cart" rides the physical rails #CAMAHEAD blocks BEHIND the viewer and
# sets the speed -- however fast the rails push it -- so the rig inherits real
# cart pace without any of its bounce.

# EXTRA rig height above the rail line, in TENTHS of a block. 0 = the ride
# cart rests on the smoothed line exactly like a cart on a rail (recommended).
# Also the fine-tune knob if the ride cart ever looks like it floats or sinks
# a hair. Keep it small (<= ~5) so climb corners can't lift your head into
# tunnel roofs.
scoreboard players set #CAMHEIGHT ir 0

# Length (in blocks, EVEN numbers) of the S-curve blend at every slope
# change. The camera transitions between "level" and "moving parallel with
# the 45-degree track" over exactly this distance -- lifting off shortly
# before a climb so it is already parallel when the slope arrives, and
# leveling off so it lands flat exactly at the summit height. Between blends
# it just rides parallel, however long the slope: the blend does NOT stretch
# across the whole climb, so it never accumulates into tunnel-roof
# collisions. Bigger = longer, lazier arcs; smaller = snappier.
scoreboard players set #CAMBLEND ir 6

# Glide strength for DESCENTS (and settling into valleys): each tick the
# camera closes 1/N of the remaining gap when the track drops away below it.
# Climbs don't use this -- they follow the constructed S-curve above with no
# lag. Higher = softer, floatier drops; lower = tighter; 1 = off.
scoreboard players set #CAMSMOOTH ir 6

# How high (in TENTHS of a block) the camera rides above the rail line while
# climbing. This is the crest-smoothing budget: the camera reaches the summit
# level about this many blocks early and glides level over the top. It also
# sets how early lift-off begins (roughly #CAMBLEND/2 + this + 2 blocks
# before the slope). Bigger = smoother hilltops but the cart visibly floats
# higher above the rails on the way up; smaller = hugs the climb tighter but
# lands harder on crests. Keep it <= ~25 for tunnel headroom; going below
# half of #CAMBLEND (in blocks) makes summit landings progressively harder.
# Setting this too high will probably make the camera raise too soon.
# 25 seems to be an optimal number for smooth transitions.
scoreboard players set #CAMLIFT ir 20

# How many blocks the viewer rides AHEAD of the hidden pace cart. Bigger
# pushes the empty pacing cart further behind you (it's only visible looking
# backward). Keep it at least ~40 below #AHEAD so there's always smoothed
# track under the rig. Applied cleanly on the next ride start; changing it
# mid-ride shifts the view by the difference once.
# (On Bedrock the pace cart is a virtual position computed by the script, so
# there is nothing to see behind you; the knob works the same.)
scoreboard players set #CAMAHEAD ir 64

# BEDROCK EDITION ONLY (ignored on Java). Camera mode:
#   0 = native rig (recommended): you sit in the gliding cart with the normal
#       first-person camera -- full free-look with zero added latency.
#   1 = cinematic: the view is detached onto Bedrock's native camera system
#       and eased along the path for extra glide, at the cost of your look
#       input reaching the camera a beat (~0.15s) late.
scoreboard players set #CAMMODE ir 0

# BEDROCK EDITION ONLY (ignored on Java). Fine-tune for the minecart
# VISUAL's height, in TENTHS of a block (negative = draw it lower). The
# pack's cart model is already re-based to sit correctly at 0, so this is
# purely for taste -- keep it small (within about -3..3). Large negative
# values sink the cart ENTITY into the track blocks, where it suffocates.
# Tune live (takes effect instantly):
#   /scoreboard players set #CARTYOFF ir -1
scoreboard players set #CARTYOFF ir 0


# --- Auto-start -------------------------------------------------------------

# 1 = the ride starts by itself for the first player to appear in a fresh
# world -- no command needed. It only ever auto-starts once per world, and
# stopping with /function infinite_rail:stop stays stopped across rejoins.
# 0 = classic manual start via /function infinite_rail:start.
scoreboard players set #AUTOSTART ir 1


# --- Minecart speed (the max_minecart_speed gamerule) -----------------------
# These control the vanilla minecart max-speed gamerule (named minecartMaxSpeed
# on 1.21-era versions, max_minecart_speed on 26.x). It only has any effect when
# the world has the "Minecart Improvements" feature enabled -- without it these
# are harmless no-ops and the ride runs at vanilla speed.
#
# The default speed is applied ONCE when a ride starts; it is NOT continuously
# enforced, so you can still change /gamerule yourself mid-ride if you like.

# Default max minecart speed (blocks/second) set at ride start. Vanilla default
# is 8; raise it for a brisker journey (valid up to 1000).
scoreboard players set #MAXSPEED ir 8

# Speed used while crossing open ocean (see below). 0 disables the whole
# ocean speed-up feature and the speed stays at #MAXSPEED everywhere.
scoreboard players set #OCEANSPEED ir 32

# How many consecutive ocean-biome chunks the ride must cross before it speeds
# up to #OCEANSPEED (a chunk is 16 blocks; the biome is sampled at the cart).
scoreboard players set #OCEANCHUNKS ir 6

# How many consecutive non-ocean chunks after a speed-up before it reverts to
# #MAXSPEED (so brief islands/gaps don't keep flipping the speed).
scoreboard players set #LANDCHUNKS ir 4


# --- Slope shaping (the "event" model) -------------------------------------
# Every elevation change is a single continuous 45-degree line ("event") that
# runs until it reaches the target height, then the rail goes flat. These
# control how large and how frequent those changes are. Now that the smooth
# camera irons out every flat->slope corner, the track can afford smaller,
# more frequent elevation changes than the old 50/50 gaps -- the line hugs the
# scenery closer and the rider never feels a single corner.

# Minimum height difference (in blocks) before a new climb/descent is started.
# Also acts as hysteresis, so small terrain noise never nudges the rail.
scoreboard players set #DEADBAND ir 3

# Minimum flat blocks between two changes in the SAME direction.
# Higher = fewer, longer swoops. Terrain that rises faster than this allows
# gets tunneled through instead of climbed.
scoreboard players set #SAMEGAP ir 25

# Minimum flat blocks required before the rail may REVERSE direction.
# Higher = no quick up-then-down bobbing; small bumps get tunneled through and
# small dips get bridged across.
scoreboard players set #TURNGAP ir 40


# --- Terrain-smoothing sensitivity -----------------------------------------
# Per-column limits on how far a single lookahead sample may pull the rolling
# average up or down.

# Larger = approaching mountains raise the target sooner (earlier, gentler
# "one swoop" climbs).
scoreboard players set #UPCLAMP ir 150

# Smaller = ravines, holes and canyons are ignored and bridged dead level
# instead of dipped into.
scoreboard players set #DOWNCLAMP ir 50


# --- Performance / world generation ----------------------------------------

# How far ahead of the (hidden) pace cart the RAILS are kept built. The
# viewer rides #CAMAHEAD ahead of that cart, so the visible track ahead of
# them is roughly #AHEAD - #CAMAHEAD. Keep this comfortably above #CAMAHEAD,
# and below ~250 (the rolling forceload releases chunks 256 behind the build
# head -- the pace cart must never fall into that zone).
scoreboard players set #AHEAD ir 224

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


# --- Debugging --------------------------------------------------------------

# 1 = print chat messages about the minecart-speed system: the default speed
# applied at start, each ocean-biome / land chunk crossed (with the running
# counters), and every speed change. Use this to see whether ocean detection is
# firing. 0 = silent (normal play).
#
# NOTE: the speed only actually changes the ride if the world has the vanilla
# "Minecart Improvements" feature enabled (that's what adds the
# minecartMaxSpeed / max_minecart_speed gamerule). If debug shows the speed
# being set but the cart never gets faster, recreate the world with that
# experiment/feature turned on.
scoreboard players set #DEBUGMODE ir 0
