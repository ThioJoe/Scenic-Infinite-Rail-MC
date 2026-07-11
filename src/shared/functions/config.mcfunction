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
#  directly in chat, e.g.:   /scoreboard players set .HOVER cfg_terrain 8
#  Live scoreboard edits take effect on the very next track column, and are
#  reset back to the values below on the next /reload or rejoin.
#
#  WHERE THE VALUES LIVE: each setting sits in one of three sidebar-sized
#  scoreboard objectives -- cfg_terrain (terrain following / slope shaping),
#  cfg_camera (the ride rig) and cfg_ride (speed, mode knobs, performance) --
#  so the in-game Debug menu can show any whole group on the scoreboard
#  sidebar (a vanilla sidebar displays one objective, max 15 rows). The
#  objective name is right there in each line below; use the same name in
#  /scoreboard commands. (.DEBUGMODE, .AUTOSTART and .SAMPLE_BLOCK_INTERVAL
#  stay in the plain `ir` objective with the runtime state -- not worth
#  sidebar rows.)
# =============================================================================


# --- Ride feel -------------------------------------------------------------

# Cruising altitude: how many blocks of clearance the rail keeps above the
# average terrain surface. Higher = a more sweeping, birds-eye view.
# Keep it at least 2: the redstone power block under the rail is immune to
# water, but the rail itself is not, so the track must stay above sea level.
scoreboard players set .HOVER cfg_terrain 2

# How high (in blocks above the rail) each column's clearance bore is carved --
# i.e. the tunnel/headroom height. Slope columns automatically carve one block
# taller. Keep it at least 3 (the tunnel light sits at rail+3). Bigger = airier
# tunnels and cuttings at the cost of more blocks changed per column.
# (Named like .SLOPECLEAR: both describe what the carve clears.)
scoreboard players set .TUNNELCLEAR cfg_terrain 6


# --- Smooth camera (the ride rig) --------------------------------------------
# The rider sits -- mounted once, never remounted -- in a real minecart that
# is glued to an invisible interpolated "camera seat", gliding OFF the rails
# along a pre-smoothed S-curve computed from the track's recorded profile:
# climbs begin rising BEFORE the corner, steady 45-degree runs are followed
# exactly parallel with zero lag, and descents use a reactive exponential
# glide. The camera never drops below the rail line. Meanwhile a hidden
# "pace cart" rides the physical rails (.PACE_CART_BEHIND - .RIDER_BEHIND)
# blocks BEHIND the viewer and sets the speed -- however fast the rails push
# it -- so the rig inherits real cart pace without any of its bounce.

# EXTRA rig height above the rail line, in TENTHS of a block. 0 = the ride
# cart rests on the smoothed line exactly like a cart on a rail (recommended).
# Also the fine-tune knob if the ride cart ever looks like it floats or sinks
# a hair. Keep it small (<= ~5) so climb corners can't lift your head into
# tunnel roofs.
scoreboard players set .CAMHEIGHT cfg_camera 0

# Length (in blocks, EVEN numbers) of the S-curve blend at every slope
# change. The camera transitions between "level" and "moving parallel with
# the 45-degree track" over exactly this distance -- lifting off shortly
# before a climb so it is already parallel when the slope arrives, and
# leveling off so it lands flat exactly at the summit height. Between blends
# it just rides parallel, however long the slope: the blend does NOT stretch
# across the whole climb, so it never accumulates into tunnel-roof
# collisions. Bigger = longer, lazier arcs; smaller = snappier.
scoreboard players set .CAMBLEND cfg_camera 6

# Glide strength for DESCENTS (and settling into valleys): each tick the
# camera closes 1/N of the remaining gap when the track drops away below it.
# Climbs don't use this -- they follow the constructed S-curve above with no
# lag. Higher = softer, floatier drops; lower = tighter; 1 = off.
scoreboard players set .CAMSMOOTH cfg_camera 6

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
scoreboard players set .CAMLIFT cfg_camera 20

# How many blocks BEHIND THE BUILD HEAD the viewer (the camera rig) rides.
# Like every distance knob this is measured from the head -- the column
# currently being decided/built -- so all the forward-planning knobs read on
# one ruler. The hidden pace cart rides .PACE_CART_BEHIND behind the head
# (below), so the cart trails the viewer by (.PACE_CART_BEHIND -
# .RIDER_BEHIND) blocks -- 64 at the defaults (it's only visible looking
# backward). Keep this BELOW .PACE_CART_BEHIND (the rig must lead the cart)
# and at least ~40 above 0 so there's always smoothed track under the rig.
# Applied cleanly on the next ride start; changing it mid-ride shifts the
# view by the difference once.
# (On Bedrock the pace cart is a virtual position computed by the script, so
# there is nothing to see behind you; the knob works the same.)
scoreboard players set .RIDER_BEHIND cfg_camera 160

# BEDROCK EDITION ONLY (ignored on Java). Camera mode:
#   0 = native rig (recommended): you sit in the gliding cart with the normal
#       first-person camera -- full free-look with zero added latency.
#   1 = cinematic: the view is detached onto Bedrock's native camera system
#       and eased along the path for extra glide, at the cost of your look
#       input reaching the camera a beat (~0.15s) late.
scoreboard players set .CAMMODE cfg_camera 0

# BEDROCK EDITION ONLY (ignored on Java). Fine-tune for the minecart
# VISUAL's height, in TENTHS of a block (negative = draw it lower). The
# pack's cart model is supposed to be already re-based to sit correctly at 0, 
# but in reality ~12 or seems to be correct.
# Purely for taste. Large negative values sink the cart ENTITY into
# the track blocks, where it may suffocate (untested).
# Tune live (takes effect instantly):
#   /scoreboard players set .CARTYOFF cfg_camera -1
scoreboard players set .CARTYOFF cfg_camera 12

# (The old Bedrock-only .HIDEHAND knob is RETIRED. The invisibility effect
# it toggled to hide the first-person arm is also the one thing that
# decides whether Bedrock mobs can see the rider at all, so it now belongs
# to the "Mobs aggro" ride mode instead: mode_aggro_off = invisible to mobs
# AND the arm is hidden; mode_aggro_on (the default) = mobs notice you and
# the arm shows. See the ride-modes list below.)


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
# The speed applied at ride start (and restored after every ocean sprint) is
# the ADJUSTABLE ride speed -- the .speed state score, nudged .SPEEDSTEP
# blocks/s per click by the "Speed -"/"Speed +" hotbar items (floored at 1)
# and reset from the Ride Settings menu. (.SPEEDSTEP is a fixed cross-edition
# constant in the shared consts.mcfunction, deliberately not a setting here.)
# .DEFAULTSPEED below is its DEFAULT: what .speed starts out as, and what
# Reset returns it to. On Java it is applied once per change, NOT
# continuously enforced, so you can still change /gamerule yourself mid-ride
# if you like.

# Default ride speed (blocks/second). Vanilla minecart default is 8; raise
# it for a brisker journey.
scoreboard players set .DEFAULTSPEED cfg_ride 8

# The DEFAULT speed while crossing open ocean (see below). 0 disables the
# whole ocean speed-up feature and the speed stays at .DEFAULTSPEED everywhere.
# Like .DEFAULTSPEED and .SKYSPEED this is only the SEED for an adjustable state
# score (.ocnspd): while the ocean sprint is on, the Speed -/+/Reset hotbar
# items tune the ocean cruise itself -- faster OR slower than this -- and a
# chosen ocean speed persists across reloads/rejoins; Reset returns it here.
scoreboard players set .OCEANSPEED cfg_ride 32

# How many consecutive ocean-biome chunks the ride must cross before it speeds
# up to .OCEANSPEED (a chunk is 16 blocks; the biome is sampled at the cart).
scoreboard players set .OCEANCHUNKS cfg_ride 6

# How many consecutive non-ocean chunks after a speed-up before it reverts to
# .DEFAULTSPEED (so brief islands/gaps don't keep flipping the speed).
scoreboard players set .LANDCHUNKS cfg_ride 3


# --- Slope shaping (the "event" model) -------------------------------------
# Every elevation change is a single continuous 45-degree line ("event") that
# runs until it reaches the target height, then the rail goes flat. These
# control how large and how frequent those changes are. Now that the smooth
# camera irons out every flat->slope corner, the track can afford smaller,
# more frequent elevation changes than the old 50/50 gaps -- the line hugs the
# scenery closer and the rider never feels a single corner.

# Minimum size (in blocks) of any climb/descent -- both to START one (the
# target must be at least this far away; also the hysteresis that keeps
# terrain noise from nudging the rail) and to END one: an event that has
# run fewer than this many columns keeps sloping, overshooting a target the
# moving average pulled back mid-event, so a value of 2 really means "no
# change smaller than 2 blocks". (One exception: a descent that would cut
# into scanned ground ends early whatever its size -- it never trenches.)
scoreboard players set .MIN_CHANGE cfg_terrain 2

# Minimum flat blocks between two changes in the SAME direction.
# Higher = fewer, longer swoops. Terrain that rises faster than this allows
# gets tunneled through instead of climbed. (After a LARGE climb or descent
# the effective gap is shortened by the big-event gap credit -- .GAPRATIO /
# .GAPMATCH below -- so a long gap here calms typical terrain without
# stretching out big mountain work.)
scoreboard players set .SAMEGAP cfg_terrain 75

# Minimum flat blocks required before the rail may REVERSE direction --
# split by WHICH reversal, because the two read differently on a ride:
# there are legitimate reasons to come back down soon after a climb (off a
# narrow peak), but a descent followed quickly by a climb reads as a
# pointless dip. Both are shortened by the big-event gap credit below (so
# a 40-block climb up a narrow mountain doesn't shoot a gap-long bridge
# past the peak before it may come back down).

# ...at the TOP: flat blocks required after a CLIMB before the rail may
# descend again. Lower = comes back down off peaks sooner.
scoreboard players set .TURNGAP_TOP cfg_terrain 60

# ...at the BOTTOM: flat blocks required after a DESCENT before the rail
# may climb again. Higher = never dips into a hollow just to climb right
# back out; small dips get bridged across instead.
scoreboard players set .TURNGAP_BOTTOM cfg_terrain 100

# --- The big-event gap credit --------------------------------------------
# Long gaps make calm, stately track on ordinary terrain -- but after a LARGE
# elevation change they misfire: reaching the top of a tall narrow mountain,
# the line must run a full .TURNGAP_TOP of flat bridge past the peak before it
# may descend; and one big ascent too tall for a single event gets its climbs
# spread .SAMEGAP apart, tunneling in between. A big event was clearly a
# major terrain feature, so it EARNS the next event an earlier start: the
# required gap is reduced by this PERCENT of the last event's height.
# (Percent because scoreboards are int-only -- the x100 fixed point is what
# lets the ratio be fractional.) With 50, a 40-block climb shortens the next
# gap by 20 columns; 67 credits two thirds (a 1/1.5 ratio); 100 credits the
# full height; above 100 works too (150 = one and a half times the height).
# 0 = the credit is off and the gaps always apply in full. The discounted
# gap never drops below 0, and small everyday events (a few blocks) earn
# next to nothing, so typical terrain still gets the full gaps.
scoreboard players set .GAPRATIO cfg_terrain 50

# The credit's worth-it guard: the newly wanted climb/descent must itself be
# at least this PERCENT of the last event's height, or the full gap applies.
# With 50, only a follow-up at least HALF the size of the big event may
# start early -- coming back down off the mountain qualifies, a 3-block bob
# at the summit does not. 67 demands two thirds, 100 demands a follow-up at
# least as large as the event that earned the credit. 0 = no size
# requirement (any wanted change may use the discount).
scoreboard players set .GAPMATCH cfg_terrain 75

# The descent shift's required BOTTOM: a DESCENT that is only waiting for a
# spacing gap may jump the gap entirely (descend sooner, right at the
# drop-off) when a "logical second pass" over the terrain ahead verifies
# the whole plan before anything is built: the entire 45-degree descent
# path must stay clear of the ground (up to .PLOW_GRACE_DOWN levels of
# cut-through allowed -- so it lands as ONE unbroken swoop at the same
# level it would have reached anyway), and the landing must be a real
# BOTTOM -- this many columns of ground sitting at the landing level, i.e.
# this many columns of straight ridable track at the bottom. The calm the
# gap exists to guarantee then simply happens down there, instead of as a
# long flat bridge overshooting a peak. Ground still falling away past the
# landing does NOT count (gentle downhill faces keep their gap-paced
# swoops). This knob is the required bottom length, in columns. 0 = the
# shift is off. The scan reaches at most 96 blocks, so descents deeper
# than about 96 minus this never shift (they wait out their gap as
# before); keep .TERRAIN_GENAHEAD comfortably above the reach. Lives in
# cfg_ride only because cfg_terrain is full (a scoreboard sidebar shows at
# most 15 rows). (The ASCENT side's late-shift needs no verification scan
# -- see .PLOW_GRACE_UP below.)
scoreboard players set .SHIFT_REQ_BOTTOM cfg_ride 30


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
scoreboard players set .SLOPECLEAR cfg_terrain 6


# --- Terrain sampling & smoothing -------------------------------------------
# The line's DESIRED height each column is the average of terrain readings
# taken every .SAMPLE_BLOCK_INTERVAL blocks over the next .SAMPLE_WINDOW
# blocks ahead of the build head, plus .HOVER. All the "how far ahead"
# knobs in this file are measured from that same head, so they read on one
# ruler; keep the ordering  .SAMPLE_WINDOW <= .TERRAIN_GENAHEAD  (below) so
# the whole window always reads generated terrain (load warns if violated).

# How far ahead (blocks, from the build head) the terrain-averaging window
# reaches. This is the line's planning horizon: it also caps the near-ground
# scan feeding the slope-timing guards (.DOWNLOOK_AHEAD below, and the
# climb-side scan which always uses this full reach). Longer = smoother,
# earlier-reacting line that averages away small features; shorter = a more
# reactive line that hugs local terrain. (The sample count is derived:
# .SAMPLE_WINDOW / .SAMPLE_BLOCK_INTERVAL readings -- 12 at the defaults.)
scoreboard players set .SAMPLE_WINDOW cfg_terrain 75

# The spacing (blocks) between terrain readings inside the window. Smaller =
# denser sampling (more probes per column -- costlier); larger = cheaper but
# features narrower than the spacing can slip between readings. The sample
# count per column is .SAMPLE_WINDOW / this. (Lives in the plain `ir`
# objective with .DEBUGMODE/.AUTOSTART -- an advanced knob not worth one of
# cfg_terrain's 15 sidebar rows.)
scoreboard players set .SAMPLE_BLOCK_INTERVAL ir 1

# Terrain lower than the current line by more than this reads as only this
# many blocks lower. This is why a narrow 60-deep ravine is crossed as a
# dead-level bridge (it reads as a 20-deep dip diluted across the average)
# while a broad valley still lowers the line properly. Bigger = the line
# dives after every hole; smaller = it bridges more and descends less.
# (There is deliberately no upward twin: terrain ABOVE the line always
# registers at its full height, so every mountain ahead raises the desired
# height to its full size and the ride goes over everything it can -- WHEN
# the climb starts is the near scan's schedule, below.)
scoreboard players set .DOWNCLAMP cfg_terrain 30


# --- Ground-aware slope timing (the near-ground scan) ------------------------
# The lookahead average above decides WHERE the rail wants to be; these four
# knobs decide WHEN to move, by checking the actual ground surface just ahead
# of the build head. Without them, slopes are timed purely by the average --
# which lags/dilutes around edges, so the line would ramp up dozens of blocks
# before a mountain, trench down early to get off one, and dip into valley
# floors it is about to leave anyway. With them: climbs start "on schedule"
# (at the LAST possible column from which a 45-degree ramp still crests what
# is coming at hover height -- there is deliberately no earlier-than-needed
# slack; .PLOW_GRACE_UP below can push the start even LATER), and descents
# never cut into ground beyond .PLOW_GRACE_DOWN -- they stop on it and
# continue, .SAMEGAP-paced like every other event, once it falls away. The
# .SAMEGAP / .TURNGAP_* spacing rules always keep the final say; these
# guards only hold events back or stop them early, never squeeze them
# closer together.
#
# The CLIMB side has no reach knob: it always scans the full .SAMPLE_WINDOW
# (the line's whole planning horizon) -- the contact detector (a climb may
# begin inside the .MIN_CHANGE deadband when the level line would physically
# hit ground ahead) and the climb SCHEDULE both use it. That reach also
# bounds the tallest wall crestable without tunneling: a rise taller than
# the window hits the line before a 45-degree ramp can finish.

# How many blocks ABOVE its average-derived target a climb may overshoot to
# clear ground the climb-side scan still sees at or above the rail line.
# Without this, a wide hilltop ends its climb at the crest-diluted average
# and tunnels right under the summit. Bigger = hills are crested over more
# often; smaller = ridgetops get punched through as before. 0 = climbs stop
# exactly at the target, never overshooting.
scoreboard players set .UPGRACE cfg_terrain 20

# How far ahead (blocks, from the build head) to scan for ground under a
# would-be descent step. A descent never steps down into the TALLEST
# surface in this range (beyond .PLOW_GRACE_DOWN levels of cut-through) --
# so descents cannot trench. When ground blocks the next step the descent
# ENDS, resting on that ground, and the line carries on downward as a NEW
# event (>= .SAMEGAP later, exactly like any other) once the ground has
# dropped away -- long descents down rough slopes become clean 45-degree
# swoops separated by proper benches, never 1-2 column stair-steps. The
# window is also the "clear runway" requirement: dips and gaps NARROWER
# than this are crossed level (bridged) instead of dipped into. Bigger = a
# calmer line that only descends into wider openings; smaller = hugs every
# little hollow. HARD-CAPPED at .SAMPLE_WINDOW (the scan never reaches
# past the sampling horizon -- values above it just mean "the full
# window", like the default here). 0 = descent timing is ruled by the
# average alone (the old plow-prone behavior).
scoreboard players set .DOWNLOOK_AHEAD cfg_terrain 250

# --- The plow graces: trade a little digging for better slope placement ----
# Both are "how many vertical block levels the line may CUT INTO the ground
# to place a slope where it reads better", one per direction, 0 = never cut
# more than today. The line still prefers not to cut at all -- the grace
# only applies where tolerating a shallow cut lets the slope sit
# meaningfully earlier (descents) or later (climbs), and the carve simply
# opens the bore through whatever it crosses.

# DESCENTS (shift/end them SOONER): how many levels below the tallest
# scanned ground (within .DOWNLOOK_AHEAD) a descending step may cut. This
# relaxes both the descent floor -- a descent ends this deep INTO the
# highest nearby ground instead of stopping on top of it -- and the descent
# shift's path check (.SHIFT_REQ_BOTTOM above): a planned swoop may carve
# through bumps up to this tall on its way down, so one shallow lip on an
# otherwise-clear drop no longer blocks the whole early descent. 0 = only
# ever touch down on the surface, never into it.
scoreboard players set .PLOW_GRACE_DOWN cfg_terrain 1

# CLIMBS (shift them LATER): how many blocks of crest clearance the climb
# schedule may give up to start later. The schedule normally releases a
# climb at the last column from which the 45-degree ramp still clears
# everything coming at full .HOVER height; each grace level here delays
# that by one column, letting the ramp arrive that much lower -- shaving
# hover clearance first, then (past .HOVER levels) genuinely cutting into
# the leading face, which the carve bores through. 0 = always crest with
# full hover clearance, never cut.
scoreboard players set .PLOW_GRACE_UP cfg_terrain 1


# --- Performance / world generation ----------------------------------------
# The build HEAD (the column currently being decided/built) is the zero
# point every distance in this file is measured from. Ahead of it (+east):
# the sampling window (.SAMPLE_WINDOW) and the generated corridor
# (.TERRAIN_GENAHEAD). Behind it: the rig (.RIDER_BEHIND) and the hidden
# pace cart (.PACE_CART_BEHIND). Keep the ordering
#   .SAMPLE_WINDOW <= .TERRAIN_GENAHEAD      (scan only generated terrain)
#   .RIDER_BEHIND  <  .PACE_CART_BEHIND      (the rig must lead the cart)
# -- load warns if either is violated.

# How many blocks BEHIND the build head the (hidden) pace cart rides --
# equivalently: how far ahead of the cart the rails are kept built. The
# viewer glides .RIDER_BEHIND behind the head, so the visible track ahead of
# them is roughly this minus .RIDER_BEHIND. Keep it above .RIDER_BEHIND, and
# below ~250 (the rolling forceload releases chunks 256 behind the build
# head -- the pace cart must never fall into that zone).
scoreboard players set .PACE_CART_BEHIND cfg_ride 224

# How far ahead of the build head (in blocks) terrain is force-GENERATED, so
# the world exists before the sampling window and the rails reach it. Terrain
# therefore exists roughly .PACE_CART_BEHIND + .TERRAIN_GENAHEAD blocks ahead
# of the cart. Bigger = more generation time (fewer flat "not generated yet"
# spots if the ride outruns world-gen) at the cost of more loaded chunks.
# Keep it comfortably above .SAMPLE_WINDOW (the scanner must only ever read
# generated terrain).
scoreboard players set .TERRAIN_GENAHEAD cfg_ride 192

# Maximum track columns built per game tick. Higher = better catch-up if the
# server hitches, at the cost of more work per tick.
scoreboard players set .BUILD_PER_TICK cfg_ride 15


# --- Ride modes (see the mode_* functions) -----------------------------------
# The modes themselves are toggled with chat commands, not here:
# (spell the path infinite_rail:<name> on Java, infinite_rail/<name> on Bedrock)
#   mode_rain_on      permanent rain            (_off)
#   mode_night_on     night only, frozen midnight (mode_night_off = default)
#   mode_day_on       day only, frozen noon       (mode_day_off = default)
#   mode_torches_on   torch-scattered track, day and night
#   mode_torches_auto torches beside new track at night only (the default)
#   mode_torches_off  no new torches
#   mode_light_on     bright track light above new rails (level 11, default)
#   mode_light_low    dim track light (level 8)
#   mode_light_off    no track light -- dark tunnels and nights
#   mode_aggro_on     hostile mobs notice you and react (the default)
#   mode_aggro_off    invisible to mobs -- the ride glides by unnoticed
#                     (on Bedrock this also hides the first-person arm)
#   mode_sky_on       high-altitude cruise      (_off)
#   mode_sound_on     minecart rolling sound    (_off; default from .CARTSOUND below)
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
scoreboard players set .SKYY cfg_ride 120

# Sky mode: the DEFAULT cruising speed (blocks/second) while the mode is on.
# There is nothing nearby to look at up there, so it defaults to ocean pace.
# This is only the SEED for the adjustable sky cruise (the .skyspd state
# score): sky mode jumps to this the first time, but the Speed -/+/Reset
# hotbar items tune it live WHILE SKY MODE IS ON (the land speed is left
# untouched, and a chosen sky speed persists across reloads/rejoins like every
# mode; Reset returns it to this value). Applied when the mode is toggled on
# (and at ride start if the mode was left on); mode_sky_off restores the land
# speed. The ocean speed-up is paused while sky mode owns the speed.
scoreboard players set .SKYSPEED cfg_ride 18

# Torch mode: the DEFAULT percent chance (0-100) that each newly built
# column plants a torch somewhere beside the track (.TORCHRANGE below
# controls how far out). This is only the SEED for the .torchdens state
# score (modes_init copies it once, on the first load): the Visual Settings menu's
# density presets -- Low 15 / Medium 35 / High 70 / Max 100 -- own the live
# value afterwards, and a chosen density survives reloads, rejoins and ride
# restarts like every mode. Torches skip lava ground (and plant a sea pickle
# on the bed over water -- see .SEAPICKLE), and only NEW track built while
# torches are enabled gets them (mode 1 = always; the default auto mode 2 =
# only while it is night -- the shared torch_auto decides per column).
scoreboard players set .TORCHODDS cfg_ride 35

# Torch mode: how far (in blocks) a torch may land from the track's
# centerline. Each torch rolls a random distance from 2 up to this, on a
# random side. The floor of 2 keeps torches out of the carved bore. On Java,
# values above 8 automatically widen the rolling forceload corridor so the
# whole torch band stays loaded and generated (a few more chunks in memory
# while torches are actually being planted -- in auto mode that means only
# at night); both editions cap the effective value at 48.
scoreboard players set .TORCHRANGE cfg_ride 32

# Torch mode: where a torch would land ON WATER, plant a sea pickle on the
# sea/lake/river bed instead (a torch can't stand on water). This is the
# NUMBER of pickles in the cluster, which sets its brightness: 1 = light 6,
# 2 = light 9, 3 = light 12, 4 = light 15 (a torch is 14, so 4 is the closest
# match). 0 = plant nothing (the old skip-water behavior). Always on by
# default as part of torch mode; there is no in-game Settings toggle for it.
scoreboard players set .SEAPICKLE cfg_ride 4

# Minecart sound: whether the ride is accompanied by the classic minecart
# sound. The cart you sit in glides along the smoothed camera path instead
# of rolling on the rails, so it makes no sound of its own -- each edition
# re-creates it by playing the vanilla FIRST-PERSON riding sample (the one
# you hear sitting inside a cart) at the rider on a repeating clock:
#   Java     /playsound entity.minecart.inside every 115 ticks (the
#            sample's length) at a large volume so it never fades as the
#            ride moves. Pure vanilla command, no resource pack needed.
#   Bedrock  the pack's own resource pack plays the same sample; the file
#            loops natively (FMOD loop flag) and its sound definition is
#            attenuation-free, so it is played once and simply left running.
# 1 = on, 0 = the silent glide. This is only the DEFAULT for the .SOUNDMODE
# state score (modes_init copies it once, on the first load): the Settings
# menu's Sound switch (mode_sound_on / mode_sound_off) owns the live value
# afterwards, and a chosen setting survives reloads, rejoins and ride
# restarts like every mode.
scoreboard players set .CARTSOUND cfg_ride 1


# --- Debugging --------------------------------------------------------------

# 1 = print chat messages about the minecart-speed system: the default speed
# applied at start, each ocean-biome / land chunk crossed (with the running
# counters), and every speed change. Use this to see whether ocean detection is
# firing. 0 = silent (normal play). Also togglable in-game from the Debug
# menu item (the hotbar book/menu next to Settings), which additionally
# offers the scoreboard sidebar views of the three settings groups above and
# of the live ride state.
#
# NOTE: the speed only actually changes the ride if the world has the vanilla
# "Minecart Improvements" feature enabled (that's what adds the
# minecartMaxSpeed / max_minecart_speed gamerule). If debug shows the speed
# being set but the cart never gets faster, recreate the world with that
# experiment/feature turned on.
scoreboard players set .DEBUGMODE ir 0

