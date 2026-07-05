# Chooses this column's vertical move (.dir: -1 down, 0 flat, 1 up) using the
# "event" model. An event is a single continuous run of ascending OR descending
# columns -- a straight 45-degree line, corner to corner, of any length. The
# rail is NEVER stair-stepped (up, flat, up, flat); it either holds a level or
# slopes cleanly, and the spacing gaps pace how often events may happen.
#
# .slope is the direction of the event in progress (0 = running flat).
# Once an event starts it continues every column, at 45 degrees, until it
# reaches the target (or, descending, the ground). Only when flat do the
# spacing gaps get a say in whether a new event may begin.
#
# Besides .target and .railY, the native side supplies three GROUND-CONTACT
# inputs each column from its near scan (CONTEXT.md section 7j; the scan
# reads terrain in probe PAIRS so 1-2 block spikes like tree trunks are
# invisible to all three):
#   .gfloor = highest ground within .DOWNLOOK  (the descent floor's basis)
#   .gmax   = highest ground within .UPLOOK    (the climb contact trigger)
#   .gcone  = the climb "schedule": over ground actually in the way (above
#             .railY - .HOVER -- what the line already clears level needs no
#             climb), the highest 45-DEGREE PROJECTION, height - distance:
#             the height the rail must ALREADY be at for a 45-degree ramp
#             from here to crest everything coming. -10000 = nothing ahead
#             needs climbing (the schedule gate holds).
# They time the events against the actual ground instead of only the lagging
# 48-block average: descents refuse to dig (they stop just above ground and
# a later, gap-paced event carries on once it falls away), and climbs start
# on schedule -- just early enough to crest what is coming -- instead of
# ramping up as soon as the average sees a mountain.
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
# Sentinels: .gfloor/.gmax arrive as -10000 when a scan window is 0 or
# found no generated terrain (their guards fail open, the rules go inert).
# .gcone arrives as -10000 when nothing within the scan needs climbing (the
# schedule gate HOLDS -- there is nothing to be due for) and +32000 when
# the scan had no data at all (the gate never holds -- plain average-driven
# behavior). The add-0 lines only create .gfloor/.gmax at 0 if a native
# side has never written them so the operations below always have defined
# operands; .gcone is deliberately NOT seeded -- if it was never written,
# the .cgate operation fails and .due stays 1, the correct fail-open.
#   .dig  = one more DOWN step would land the rail below the descent floor
#           (.gfloor + .DOWNGRACE -- the tallest ground within .DOWNLOOK).
#           An in-progress descent ENDS here, resting just above the ground
#           it was about to cut into; once the ground falls away, the next
#           descent event carries on -- >= .SAMEGAP later, like any other.
#           So descents never trench, and never micro-stair-step either:
#           every stop is a real event end, paced by the gaps.
#   .dig2 = there is not even room for TWO down steps -- a descent must not
#           START here (no clear runway; hold the level and wait for the
#           drop-off instead of opening an event that would stop at once).
#   .push = the rail is not yet a full .HOVER above the highest ground
#           within .UPLOOK (.railY < .gmax + .HOVER) and may still overshoot
#           the target (below .target + .UPGRACE) -- an in-progress climb
#           keeps climbing until it rides at proper hover height over the
#           obstruction, instead of ending under (or skimming along) it and
#           then parking a block low inside the deadband.
#   .due  = the climb schedule says NOW: the rail is within .UPEARLY blocks
#           of the height the 45-degree cone demands (.gcone + .HOVER).
#           consider_start refuses to begin a climb before it is due, which
#           is what stops the line ramping up dozens of blocks early just
#           because the average saw a mountain coming. The flat gap keeps
#           counting while a climb is held, so waiting costs nothing.
# Sky mode bypasses all of these: it holds .SKYY dead level and punches
# through whatever it meets. A scan window of 0 disables that side entirely.
scoreboard players add .gfloor ir 0
scoreboard players add .gmax ir 0
scoreboard players set .dig ir 0
scoreboard players set .dig2 ir 0
scoreboard players set .push ir 0
scoreboard players set .due ir 1
scoreboard players operation .glim ir = .gfloor ir
scoreboard players operation .glim ir += .DOWNGRACE ir
scoreboard players operation .rnext ir = .railY ir
scoreboard players remove .rnext ir 1
execute unless score .SKYMODE ir matches 1 if score .DOWNLOOK ir matches 1.. if score .rnext ir < .glim ir run scoreboard players set .dig ir 1
scoreboard players remove .rnext ir 1
execute unless score .SKYMODE ir matches 1 if score .DOWNLOOK ir matches 1.. if score .rnext ir < .glim ir run scoreboard players set .dig2 ir 1
scoreboard players operation .glift ir = .target ir
scoreboard players operation .glift ir += .UPGRACE ir
scoreboard players operation .gtop ir = .gmax ir
scoreboard players operation .gtop ir += .HOVER ir
execute unless score .SKYMODE ir matches 1 if score .UPLOOK ir matches 1.. if score .railY ir < .gtop ir if score .railY ir < .glift ir run scoreboard players set .push ir 1
scoreboard players operation .cgate ir = .gcone ir
scoreboard players operation .cgate ir += .HOVER ir
scoreboard players operation .cgate ir += .UPEARLY ir
execute unless score .SKYMODE ir matches 1 if score .UPLOOK ir matches 1.. if score .railY ir >= .cgate ir run scoreboard players set .due ir 0

# --- Continue an in-progress climb/descent until it reaches the target ---
# A climb also continues past the target while ground is still at or above
# the rail line just ahead (.push): it crests the obstruction -- up to
# .UPGRACE above the target -- instead of stopping under it and tunneling
# the summit. A descent whose next step would dig (.dig) ends here instead,
# resting just above the ground; the gaps pace when the next may start.
execute if score .slope0 ir matches 1 if score .diff ir matches 1.. run scoreboard players set .dir ir 1
execute if score .slope0 ir matches 1 if score .diff ir matches ..0 if score .push ir matches 1 run scoreboard players set .dir ir 1
execute if score .slope0 ir matches 1 if score .diff ir matches ..0 if score .push ir matches 0 run function ir_end_event
execute if score .slope0 ir = .nOne ir if score .diff ir <= .nOne ir if score .dig ir matches 0 run scoreboard players operation .dir ir = .nOne ir
execute if score .slope0 ir = .nOne ir if score .diff ir <= .nOne ir if score .dig ir matches 1 run function ir_end_event
execute if score .slope0 ir = .nOne ir if score .diff ir matches 0.. run function ir_end_event

# --- If currently flat, decide whether to begin a new event ---
execute if score .slope0 ir matches 0 run function ir_consider_start

# --- Carve mode for this column (read by each edition's column placer) ---
# .veg 1 = the carve may spare natural vegetation outside the critical
# envelope; 0 = the full center bore is cleared unconditionally. Full clears
# happen on every slope column -- .dir nonzero -- and for .SLOPECLEAR flat
# columns AFTER an event ends, counted down by .vclear, which end_event
# arms. The columns just BEFORE a slope are handled retroactively: when
# start_event begins an event it raises .retro, and the edition's builder
# re-clears the center bore of the last .SLOPECLEAR columns (then resets
# .retro to 0). Left/right of the track always spare vegetation.
scoreboard players set .veg ir 1
execute if score .dir ir matches 1 run scoreboard players set .veg ir 0
execute if score .dir ir = .nOne ir run scoreboard players set .veg ir 0
execute if score .vclear ir matches 1.. run scoreboard players set .veg ir 0
execute if score .dir ir matches 0 if score .vclear ir matches 1.. run scoreboard players remove .vclear ir 1
