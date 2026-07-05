# Mode toggle:  /function infinite_rail:mode_sky_on
# High-altitude cruise: the rail leaves the terrain in one long 45-degree
# climb to the fixed altitude .SKYY (default 200 -- just above the clouds)
# and levels off dead straight above the world, at .SKYSPEED for pace (there
# is nothing nearby to look at up there). The override itself lives in the
# SHARED decide (both editions): while .SKYMODE is 1 the terrain-derived
# target is replaced with .SKYY. The terrain sampler keeps running
# underneath, so mode_sky_off glides the line right back down.
# The ocean speed-up is paused while this mode owns the speed (ocean_check
# returns early on .SKYMODE); .fast is cleared so no stale ocean state can
# fire a speed change on the way out.
scoreboard players set .SKYMODE ir 1
scoreboard players set .fast ir 0
function infinite_rail:sky_speed
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Sky mode ON - climbing to cruising altitude. ","color":"gray"},{"text":"/function infinite_rail:mode_sky_off","color":"aqua"},{"text":" brings the line back down.","color":"gray"}]
