# Enter the ocean sprint. Called by ocean_check on EVERY ocean chunk past the
# threshold; the first call (while .fast is still 0) is the ENTRY TRANSITION,
# the rest just re-assert the cruise.
#
# RAISE-ONLY. The ocean speed-up must never SLOW the ride: it lifts a slow
# rider up to the ocean speed, but a rider already going faster than the ocean
# speed keeps their speed. So on the entry transition the ocean cruise .ocnspd
# is set to the config ocean speed .OCEANSPEED, then bumped up to the land
# speed .speed if that is higher -- i.e. max(.OCEANSPEED, .speed). (The old
# code applied .ocnspd flat, which could DROP a fast rider down to the ocean
# speed.) .speed itself is left untouched, so it still holds the pre-ocean
# speed for speed_down to restore on the way back to land, and Reset (which is
# a total reset -- see speed_step) still returns .speed to .DEFAULTSPEED, so a
# mid-sprint Reset makes the ride come back to the true default land speed.
#
# Every ocean chunk the cruise (.ocnspd) is RE-APPLIED, so it always sticks and
# self-heals any manual /gamerule change; a mid-sprint Speed click already
# updated .ocnspd (the active cruise while .fast is 1), so re-applying keeps
# the user's adjustment rather than snapping back to max(.OCEANSPEED, .speed).
execute if score .fast ir matches 0 run scoreboard players operation .ocnspd ir = .OCEANSPEED cfg_ride
execute if score .fast ir matches 0 if score .speed ir > .ocnspd ir run scoreboard players operation .ocnspd ir = .speed ir
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .ocnspd ir
function infinite_rail:set_speed with storage infinite_rail:speed
# The debug line and the .fast flag flip happen only on the first call (while
# .fast is still 0), so there's no spam while cruising.
execute if score .DEBUGMODE ir matches 1 if score .fast ir matches 0 run tellraw @a [{"text":"[SR Debug] ","color":"dark_aqua"},{"text":"entering ocean sprint, speed ","color":"aqua"},{"score":{"name":".ocnspd","objective":"ir"},"color":"white"}]
scoreboard players set .fast ir 1
