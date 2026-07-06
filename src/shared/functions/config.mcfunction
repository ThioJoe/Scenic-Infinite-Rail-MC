# =============================================================================
#  INFINITE RAIL - ALL TUNABLE SETTINGS
#
#  This is the only file you need to edit to change the ride's defaults.
#
#  To apply your edits, run  /reload  in chat (or quit and rejoin the world).
#  Minecraft only re-reads .mcfunction files from disk on /reload; it then runs
#  this file automatically, updating a ride already in progress. IMPORTANT:
#  running the config function by itself (/function infinite_rail:config on
#  Java, /function infinite_rail/config on Bedrock) will NOT pick up file
#  edits -- it just re-runs the copy already loaded in memory. Its only real use
#  is to reset live tweaks (below) back to the values in this file.
#
#  To experiment with ONE value without editing this file, set its score
#  directly in chat, e.g.:   /scoreboard players set .HOVER ir 8
#  Live scoreboard edits take effect on the very next track column, and are
#  reset back to the values below on the next /reload or rejoin.
# =============================================================================


# --- Ride feel -------------------------------------------------------------

# Cruising altitude: how many blocks of clearance the rail keeps above the
# average terrain surface. Higher = a more sweeping, birds-eye view.
# Keep it at least 2: the redstone power block under the rail is immune to
# water, but the rail itself is not, so the track must stay above sea level.
scoreboard players set .HOVER ir 2

# How high (in blocks above the rail) each column's clearance bore is carved --
# i.e. the tunnel/headroom height. Slope columns automatically carve one block
# taller. Keep it at least 3 (the tunnel light sits at rail+3). Bigger = airier
# tunnels and cuttings at the cost of more blocks changed per column.
scoreboard players set .TUNNEL ir 6


# --- Smooth camera (the ride rig) --------------------------------------------
# The rider sits -- mounted once, never remounted -- in a real minecart that
# is glued to an invisible interpolated "camera seat", gliding OFF the rails
# along a pre-smoothed S-curve computed from the track's recorded profile:
# climbs begin rising BEFORE the corner, steady 45-degree runs are followed
# exactly parallel with zero lag, and descents use a reactive exponential
# glide. The camera never drops below the rail line. Meanwhile a hidden
# "pace cart" rides the physical rails .CAMAHEAD blocks BEHIND the viewer and
# sets the speed -- however fast the rails push it -- so the rig inherits real
# cart pace without any of its bounce.

# EXTRA rig height above the rail line, in TENTHS of a block. 0 = the ride
# cart rests on the smoothed line exactly like a cart on a rail (recommended).
# Also the fine-tune knob if the ride cart ever looks like it floats or sinks
# a hair. Keep it small (<= ~5) so climb corners can't lift your head into
# tunnel roofs.
scoreboard players set .CAMHEIGHT ir 0

# Length (in blocks, EVEN numbers) of the S-curve blend at every slope
# change. The camera transitions between "level" and "moving parallel with
# the 45-degree track" over exactly this distance -- lifting off shortly
# before a climb so it is already parallel when the slope arrives, and
# leveling off so it lands flat exactly at the summit height. Between blends
# it just rides parallel, however long the slope: the blend does NOT stretch
# across the whole climb, so it never accumulates into tunnel-roof
# collisions. Bigger = longer, lazier arcs; smaller = snappier.
scoreboard players set .CAMBLEND ir 6

# Glide strength for DESCENTS (and settling into valleys): each tick the
# camera closes 1/N of the remaining gap when the track drops away below it.
# Climbs don't use this -- they follow the constructed S-curve above with no
# lag. Higher = softer, floatier drops; lower = tighter; 1 = off.
scoreboard players set .CAMSMOOTH ir 6

# How high (in TENTHS of a block) the camera rides above the rail line while
# climbing. This is the crest-smoothing budget: the camera reaches the summit
# level about this many blocks early and glides level over the top. It also
# sets how early lift-off begins (roughly .CAMBLEND/2 + this + 2 blocks
# before the slope). Bigger = smoother hilltops but the cart visibly floats
# higher above the rails on the way up; smaller = hugs the climb tighter but
# lands harder on crests. Keep it <= ~25 for tunnel headroom; going below
# half of .CAMBLEND (in blocks) makes summit landings progressively harder.
# Setting this too high will probably make the camera raise too soon.
# 25 seems to be an optimal number for smooth transitions.
scoreboard players set .CAMLIFT ir 20

# How many blocks the viewer rides AHEAD of the hidden pace cart. Bigger
# pushes the empty pacing cart further behind you (it's only visible looking
# backward). Keep it at least ~40 below .AHEAD so there's always smoothed
# track under the rig. Applied cleanly on the next ride start; changing it
# mid-ride shifts the view by the difference once.
# (On Bedrock the pace cart is a virtual position computed by the script, so
# there is nothing to see behind you; the knob works the same.)
scoreboard players set .CAMAHEAD ir 64

# BEDROCK EDITION ONLY (ignored on Java). Camera mode:
#   0 = native rig (recommended): you sit in the gliding cart with the normal
#       first-person camera -- full free-look with zero added latency.
#   1 = cinematic: the view is detached onto Bedrock's native camera system
#       and eased along the path for extra glide, at the cost of your look
#       input reaching the camera a beat (~0.15s) late.
scoreboard players set .CAMMODE ir 0

# BEDROCK EDITION ONLY (ignored on Java). Fine-tune for the minecart
# VISUAL's height, in TENTHS of a block (negative = draw it lower). The
# pack's cart model is already re-based to sit correctly at 0, so this is
# purely for taste -- keep it small (within about -3..3). Large negative
# values sink the cart ENTITY into the track blocks, where it suffocates.
# Tune live (takes effect instantly):
#   /scoreboard players set .CARTYOFF ir -1
scoreboard players set .CARTYOFF ir 12

# BEDROCK EDITION ONLY (ignored on Java). 1 = hide the rider's first-person
# arm automatically, like turning on the "Hide Hand" video setting, for a
# clean cinematic view. Bedrock's /hud command has no element for the hand,
# so this uses the one vanilla mechanism that reaches it: an invisibility
# effect on the rider -- the inventory keeper keeps everything except the
# Settings book (the mode-menu item) out of your hands, so normally nothing
# renders at all. Side effect: your own body is also hidden
# in third-person / F5 view (the cart still shows). 0 = leave the arm
# visible. Live-tunable mid-ride (takes effect within a second).
# (Java has no equivalent mechanism; the Java rider keeps their arm.)
scoreboard players set .HIDEHAND ir 1


# --- Auto-start -------------------------------------------------------------

# 1 = the ride starts by itself for the first player to appear in a fresh
# world -- no command needed. It only ever auto-starts once per world, and
# stopping with the stop function stays stopped across rejoins.
# 0 = classic manual start via the start function (/function
# infinite_rail:start on Java, /function infinite_rail/start on Bedrock).
scoreboard players set .AUTOSTART ir 1


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
scoreboard players set .MAXSPEED ir 8

# Speed used while crossing open ocean (see below). 0 disables the whole
# ocean speed-up feature and the speed stays at .MAXSPEED everywhere.
scoreboard players set .OCEANSPEED ir 32

# How many consecutive ocean-biome chunks the ride must cross before it speeds
# up to .OCEANSPEED (a chunk is 16 blocks; the biome is sampled at the cart).
scoreboard players set .OCEANCHUNKS ir 6

# How many consecutive non-ocean chunks after a speed-up before it reverts to
# .MAXSPEED (so brief islands/gaps don't keep flipping the speed).
scoreboard players set .LANDCHUNKS ir 3


# --- Slope shaping (the "event" model) -------------------------------------
# Every elevation change is a single continuous 45-degree line ("event") that
# runs until it reaches the target height, then the rail goes flat. These
# control how large and how frequent those changes are. Now that the smooth
# camera irons out every flat->slope corner, the track can afford smaller,
# more frequent elevation changes than the old 50/50 gaps -- the line hugs the
# scenery closer and the rider never feels a single corner.

# Minimum height difference (in blocks) before a new climb/descent is started.
# Also acts as hysteresis, so small terrain noise never nudges the rail.
scoreboard players set .DEADBAND ir 2

# Minimum flat blocks between two changes in the SAME direction.
# Higher = fewer, longer swoops. Terrain that rises faster than this allows
# gets tunneled through instead of climbed.
scoreboard players set .SAMEGAP ir 40

# Minimum flat blocks required before the rail may REVERSE direction.
# Higher = no quick up-then-down bobbing; small bumps get tunneled through and
# small dips get bridged across.
scoreboard players set .TURNGAP ir 40


# --- Track clearing / vegetation sparing ------------------------------------
# The carve spares natural vegetation (trees, leaves, giant mushrooms, bamboo,
# plants, sugar cane, ...) outside the critical envelope: the rail cell and
# the cell above it are always cleared for the cart and rider, but to the LEFT
# and RIGHT of the track, and 2+ blocks ABOVE it, plants survive -- the ride
# brushes through forests instead of mowing a square canyon through them.
# Terrain (stone, dirt, sand, ...) still carves at full height everywhere, so
# tunnels are unchanged.

# The one exception is around slopes: the camera floats up to .CAMLIFT above
# the rail line entering, riding and leaving a climb/descent, so overhanging
# leaves there would brush the rider's face. Slope columns therefore always
# carve their full center bore, and so do this many columns just BEFORE and
# AFTER each slope (vertically only -- left/right stay vegetation-sparing).
# Cover at least the camera's lift-off run (roughly .CAMBLEND/2 + .CAMLIFT/10
# + 2 blocks) and keep it <= .SAMEGAP. 0 = only the slope columns themselves.
scoreboard players set .SLOPECLEAR ir 6


# --- Terrain-smoothing sensitivity -----------------------------------------
# The line's DESIRED height each column is the average of 12 terrain readings
# spread over the next 48 blocks, plus .HOVER. These two knobs clamp each
# reading: terrain more than this many blocks ABOVE/BELOW the current average
# only counts as this far above/below. In plain terms they set how much of a
# height feature the line acknowledges at all.

# Terrain higher than the current line by more than this reads as only this
# many blocks higher. With 250 it is effectively unlimited: every mountain
# ahead raises the desired height to its full size, so the ride goes over
# everything it can (WHEN the climb starts is a separate question -- see
# .UPEARLY below). Lowering it toward ~5 makes the desired height rise
# sluggishly, so tall terrain gets tunneled into at mid-height instead.
scoreboard players set .UPCLAMP ir 250

# Terrain lower than the current line by more than this reads as only this
# many blocks lower. This is why a narrow 60-deep ravine is crossed as a
# dead-level bridge (it reads as a 20-deep dip diluted across the average)
# while a broad valley still lowers the line properly. Bigger = the line
# dives after every hole; smaller = it bridges more and descends less.
scoreboard players set .DOWNCLAMP ir 20


# --- Ground-aware slope timing (the near-ground scan) ------------------------
# The lookahead average above decides WHERE the rail wants to be; these five
# knobs decide WHEN to move, by checking the actual ground surface just ahead
# of the build head. Without them, slopes are timed purely by the average --
# which lags/dilutes around edges, so the line would ramp up dozens of blocks
# before a mountain, trench down early to get off one, and dip into valley
# floors it is about to leave anyway. With them: climbs start "on schedule"
# (just early enough for a 45-degree ramp to crest what is coming, plus
# .UPEARLY blocks of slack), and descents never cut into ground -- they stop
# just above it and continue, .SAMEGAP-paced like every other event, once it
# falls away. The .SAMEGAP / .TURNGAP spacing rules always keep the final
# say; these guards only hold events back or stop them early, never squeeze
# them closer together.

# How far ahead (blocks) the climb-side ground scan reaches. This is both
# the contact detector (a climb may begin inside the deadband when the level
# line would physically hit ground in this range) and the reach of the climb
# SCHEDULE (see .UPEARLY) -- so it also bounds the tallest wall that can be
# crested without any tunneling: a rise taller than this reach hits the line
# before the ramp can finish. Effective maximum 48 (the scan's cap). 0 =
# climb timing is ruled by the average alone (the old behavior).
scoreboard players set .UPLOOK ir 50

# How many blocks ABOVE its average-derived target a climb may overshoot to
# clear ground the .UPLOOK scan still sees at or above the rail line.
# Without this, a wide hilltop ends its climb at the crest-diluted average
# and tunnels right under the summit. Bigger = hills are crested over more
# often; smaller = ridgetops get punched through as before. 0 = climbs stop
# exactly at the target, never overshooting.
scoreboard players set .UPGRACE ir 10

# The climb schedule's slack, in blocks: how much sooner than STRICTLY
# NECESSARY a climb may begin. The scan projects every surface ahead onto a
# 45-degree line ("to clear that point from here, the rail must already be
# at its height minus its distance"); a climb is held back -- even when the
# average is begging for one -- until the rail is within this many blocks of
# that projected height. 0 = ramps start at the last possible column and
# top out exactly at the crest; bigger = earlier, longer, more leisurely
# ramps that finish about this many blocks before the crest; ~50+ =
# no schedule at all (climbs start as soon as the average sees the mountain
# -- the old ramp-up-way-early behavior).
scoreboard players set .UPEARLY ir 2

# How far ahead (blocks) to scan for ground under a would-be descent step.
# A descent never steps down into (or within .DOWNGRACE of) the TALLEST
# surface in this range -- so descents physically cannot trench. When ground
# blocks the next step the descent ENDS, resting just above that ground, and
# the line carries on downward as a NEW event (>= .SAMEGAP later, exactly
# like any other) once the ground has dropped away -- long descents down
# rough slopes become clean 45-degree swoops separated by proper benches,
# never 1-2 column stair-steps. The window is also the "clear runway"
# requirement: dips and gaps NARROWER than this are crossed level (bridged)
# instead of dipped into. Bigger = a calmer line that only descends into
# wider openings; smaller = hugs every little hollow. 0 = descent timing is
# ruled by the average alone (the old plow-prone behavior).
scoreboard players set .DOWNLOOK ir 50

# The clearance a descending step keeps above that tallest scanned surface.
# 0 = a descent may touch down exactly onto the highest nearby ground;
# higher values stop descents sooner / keep the line flying higher over
# terrain it crosses. Keep it BELOW .HOVER, or descents end just short of
# their target even over flat ground and the line rides permanently high.
scoreboard players set .DOWNGRACE ir 1


# --- Performance / world generation ----------------------------------------

# How far ahead of the (hidden) pace cart the RAILS are kept built. The
# viewer rides .CAMAHEAD ahead of that cart, so the visible track ahead of
# them is roughly .AHEAD - .CAMAHEAD. Keep this comfortably above .CAMAHEAD,
# and below ~250 (the rolling forceload releases chunks 256 behind the build
# head -- the pace cart must never fall into that zone).
scoreboard players set .AHEAD ir 224

# How far ahead of the track head (in blocks) terrain is force-GENERATED, so the
# world exists before the rails reach it. Separate from .AHEAD: rails are built
# .AHEAD ahead of the cart, and chunks are generated .GENAHEAD ahead of the rail
# head -- so terrain exists roughly .AHEAD + .GENAHEAD blocks ahead of the cart.
# Bigger = more generation time (fewer flat "not generated yet" spots if the
# ride outruns world-gen) at the cost of more loaded chunks. Keep it above ~64
# (the heightmap scanner samples 48 blocks past the head).
scoreboard players set .GENAHEAD ir 192

# Maximum track columns built per game tick. Higher = better catch-up if the
# server hitches, at the cost of more work per tick.
scoreboard players set .MAXTICK ir 15


# --- Ride modes (see the mode_* functions) -----------------------------------
# The modes themselves are toggled with chat commands, not here:
# (spell the path infinite_rail:<name> on Java, infinite_rail/<name> on Bedrock)
#   mode_rain_on      permanent rain          (_off)
#   mode_night_on     frozen midnight         (_off)
#   mode_torches_on   torch-scattered track   (_off)
#   mode_sky_on       high-altitude cruise    (_off)
#   modes             show what is currently on
# They are STATE, not settings -- independent switches that stack freely
# (night + torches is the lantern ride, night + rain the storm ride), stick
# across /reload, ride restarts and rejoins, and never get reset by this
# file. The knobs below only shape what the modes do while they are on.

# Sky mode: the fixed altitude the rail cruises at while mode_sky_on is
# active (the shared decide steers the line to exactly this Y, one long
# 45-degree climb up and one long glide back down on mode_sky_off). The
# default rides just above the cloud layer (Y 192). Terrain taller than this
# is punched through like any rise the rail cannot climb over -- raise it
# toward ~260 to clear even the tallest jagged peaks (build limit 320).
scoreboard players set .SKYY ir 180

# Sky mode: cruising speed (blocks/second) while the mode is on. There is
# nothing nearby to look at up there, so it defaults to ocean pace. Applied
# when the mode is toggled on (and at ride start if the mode was left on);
# mode_sky_off restores .MAXSPEED. The ocean speed-up is paused while sky
# mode owns the speed.
scoreboard players set .SKYSPEED ir 18

# Torch mode: the percent chance (0-100) that each newly built column plants
# a torch somewhere beside the track (.TORCHRANGE below controls how far
# out). 10 = on average about one torch per 10 blocks of line. Torches are
# only placed where one can actually stand (never on water, ice or snow
# layers), and only on NEW track built while the mode is on.
scoreboard players set .TORCHODDS ir 35

# Torch mode: how far (in blocks) a torch may land from the track's
# centerline. Each torch rolls a random distance from 2 up to this, on a
# random side. The floor of 2 keeps torches out of the carved bore. On Java,
# values above 8 automatically widen the rolling forceload corridor so the
# whole torch band stays loaded and generated (a few more chunks in memory
# while torch mode is on); both editions cap the effective value at 48.
scoreboard players set .TORCHRANGE ir 32


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
scoreboard players set .DEBUGMODE ir 0
