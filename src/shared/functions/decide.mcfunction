# Chooses this column's vertical move (.dir: -1 down, 0 flat, 1 up) using the
# "event" model. An event is a single continuous run of ascending OR descending
# columns -- a straight 45-degree line, corner to corner, of any length. The
# rail is NEVER stair-stepped (up, flat, up, flat); it either holds a level or
# slopes cleanly until it reaches the target elevation.
#
# .slope is the direction of the event in progress (0 = running flat).
# Once an event starts it continues every column, at 45 degrees, until the
# target is reached. Only when flat do the spacing gaps get a say in whether a
# new event may begin.
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

# --- Continue an in-progress climb/descent until it reaches the target ---
execute if score .slope0 ir matches 1 if score .diff ir matches 1.. run scoreboard players set .dir ir 1
execute if score .slope0 ir matches 1 if score .diff ir matches ..0 run function ir_end_event
execute if score .slope0 ir = .nOne ir if score .diff ir <= .nOne ir run scoreboard players operation .dir ir = .nOne ir
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
