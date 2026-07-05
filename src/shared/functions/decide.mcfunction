# Chooses this column's vertical move (.dir: -1 down, 0 flat, 1 up) using the
# "event" model. An event is a single continuous run of ascending OR descending
# columns -- a straight 45-degree line, corner to corner, of any length.
# CLIMBS are never stair-stepped (up, flat, up, flat): a climb slopes cleanly
# until it reaches the target elevation. DESCENTS are monotone (never flip
# direction mid-event) but may PAUSE -- hold their level -- while the ground
# just ahead blocks the next step (the ground-hugging guard below), resuming
# the moment it falls away; the event ends only when the rail reaches the
# target, so a paused descent still lands at the normal hover height, just
# shifted forward past the obstruction.
#
# .slope is the direction of the event in progress (0 = running flat).
# Once an event starts it continues -- climbing every column, or descending
# whenever the ground allows -- until the target is reached. Only when flat
# (no event open) do the spacing gaps get a say in whether a new event may
# begin.
#
# Besides .target and .railY, the native side also supplies two GROUND-CONTACT
# inputs each column -- .gfloor / .gmax, the HIGHEST terrain surface within
# .DOWNLOOK / .UPLOOK blocks ahead (each edition's near-ground scan) -- which
# time the events against the actual ground instead of only the lagging
# average: a descent never steps down into ground (it pauses over it -- .dig --
# and won't start without clear runway -- .dig2), and climbs may crest ground
# still poking above the rail (.push).
# See the guard block below and CONTEXT.md section 7j.
#
# DIALECT NOTE: this file is shared verbatim with the Bedrock port, and
# negative literals inside `matches` ranges are not confirmed to parse on
# Bedrock's command engine. Every negative comparison therefore goes through
# .nOne (computed as 0 - 1 below), which both editions handle identically.
scoreboard players set .dir ir 0
scoreboard players set .nOne ir 0
scoreboard players remove .nOne ir 1

# --- Sky mode (mode_sky_on): cruise at a fixed altitude ---
# While .SKYMODE is 1 the terrain-derived target is replaced with the fixed
# altitude .SKYY before any slope decision, so the event model steers the
# rail there -- one long 45-degree climb -- and holds it dead level until the
# mode is switched off, when the same machinery glides the line back down
# onto the terrain-following target. Everything downstream (events, gaps,
# carve modes, the camera) is unchanged: sky mode is just a different
# opinion about where the rail wants to be.
execute if score .SKYMODE ir matches 1 run scoreboard players operation .target ir = .SKYY ir

scoreboard players operation .diff ir = .target ir
scoreboard players operation .diff ir -= .railY ir
scoreboard players operation .slope0 ir = .slope ir

# --- Ground-contact guards (fed by each edition's near-ground scan) ---
# .gfloor / .gmax arrive from the native side every column: the HIGHEST
# terrain surface within .DOWNLOOK / .UPLOOK blocks ahead of the head
# (sentinel -10000 = no data, which fails every guard open, i.e. plain event
# behavior). The add-0 lines only create the scores at 0 if a native side
# has never written them (e.g. the Bedrock startup self-test) so the
# operations below always have defined operands.
#   .dig  = one more DOWN step would land the rail below the descent floor
#           (.gfloor + .DOWNGRACE, i.e. into or too close to the tallest
#           ground just ahead) -- an in-progress descent PAUSES here: it
#           holds this level, keeps the event open, and resumes stepping
#           down the moment the ground ahead falls away. Descents therefore
#           never trench; they get shifted forward past obstructions and
#           still finish at the normal target height.
#   .dig2 = there is not even room for TWO down steps -- a descent must not
#           START here (no clear runway; hold level and wait for the
#           drop-off instead of opening an event that would pause at once).
#   .push = ground within .UPLOOK is still at or above the rail line
#           (.gmax >= .railY -- the climb has not yet cleared it by a block)
#           and the rail may still overshoot the target (below .target +
#           .UPGRACE) -- an in-progress climb keeps climbing over the
#           obstruction instead of ending under (or skimming along) it.
# Sky mode bypasses all three: it holds .SKYY dead level and punches through
# whatever it meets. Setting a scan window to 0 disables that side entirely.
scoreboard players add .gfloor ir 0
scoreboard players add .gmax ir 0
scoreboard players set .dig ir 0
scoreboard players set .dig2 ir 0
scoreboard players set .push ir 0
scoreboard players operation .glim ir = .gfloor ir
scoreboard players operation .glim ir += .DOWNGRACE ir
scoreboard players operation .rnext ir = .railY ir
scoreboard players remove .rnext ir 1
execute unless score .SKYMODE ir matches 1 if score .DOWNLOOK ir matches 1.. if score .rnext ir < .glim ir run scoreboard players set .dig ir 1
scoreboard players remove .rnext ir 1
execute unless score .SKYMODE ir matches 1 if score .DOWNLOOK ir matches 1.. if score .rnext ir < .glim ir run scoreboard players set .dig2 ir 1
scoreboard players operation .glift ir = .target ir
scoreboard players operation .glift ir += .UPGRACE ir
execute unless score .SKYMODE ir matches 1 if score .UPLOOK ir matches 1.. if score .gmax ir >= .railY ir if score .railY ir < .glift ir run scoreboard players set .push ir 1

# --- Continue an in-progress climb/descent until it reaches the target ---
# A climb also continues past the target while ground still pokes above the
# rail just ahead (.push): it crests the obstruction -- up to .UPGRACE above
# the target -- instead of stopping under it and tunneling the summit.
# A descent still wanting to go lower but blocked by ground (.dig) PAUSES:
# .dir stays 0 for this column but .slope stays -1 and no gap counting
# starts, so the descent resumes -- same event -- as soon as the ground
# ahead drops away. It ends only when the rail reaches the target (diff 0).
execute if score .slope0 ir matches 1 if score .diff ir matches 1.. run scoreboard players set .dir ir 1
execute if score .slope0 ir matches 1 if score .diff ir matches ..0 if score .push ir matches 1 run scoreboard players set .dir ir 1
execute if score .slope0 ir matches 1 if score .diff ir matches ..0 if score .push ir matches 0 run function ir_end_event
execute if score .slope0 ir = .nOne ir if score .diff ir <= .nOne ir if score .dig ir matches 0 run scoreboard players operation .dir ir = .nOne ir
execute if score .slope0 ir = .nOne ir if score .diff ir matches 0.. run function ir_end_event

# --- If currently flat, decide whether to begin a new event ---
execute if score .slope0 ir matches 0 run function ir_consider_start

# --- Carve mode for this column (read by each edition's column placer) ---
# .veg 1 = the carve may spare natural vegetation outside the critical
# envelope; 0 = the full center bore is cleared unconditionally. Full clears
# happen on every slope column -- .dir nonzero -- on every PAUSED descent
# column (.slope still nonzero while .dir is 0: the camera floats above the
# rail line for the whole event, pauses included), and for .SLOPECLEAR flat
# columns AFTER an event ends, counted down by .vclear, which end_event
# arms. The columns just BEFORE a slope are handled retroactively: when
# start_event begins an event it raises .retro, and the edition's builder
# re-clears the center bore of the last .SLOPECLEAR columns (then resets
# .retro to 0). Left/right of the track always spare vegetation.
scoreboard players set .veg ir 1
execute if score .dir ir matches 1 run scoreboard players set .veg ir 0
execute if score .dir ir = .nOne ir run scoreboard players set .veg ir 0
execute unless score .slope ir matches 0 run scoreboard players set .veg ir 0
execute if score .vclear ir matches 1.. run scoreboard players set .veg ir 0
execute if score .dir ir matches 0 if score .vclear ir matches 1.. run scoreboard players remove .vclear ir 1
