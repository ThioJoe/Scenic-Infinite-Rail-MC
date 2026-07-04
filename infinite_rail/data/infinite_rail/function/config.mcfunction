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
scoreboard players set #CAMAHEAD ir 64


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
scoreboard players set #UPCLAMP ir 75

# Smaller = ravines, holes and canyons are ignored and bridged dead level
# instead of dipped into.
scoreboard players set #DOWNCLAMP ir 25


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
