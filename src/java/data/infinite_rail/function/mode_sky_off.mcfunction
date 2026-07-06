# Mode toggle:  /function infinite_rail:mode_sky_off
# Ends the high-altitude cruise: the shared decide goes back to the
# terrain-following target, so the rail descends in one long 45-degree glide
# onto the landscape wherever the ride happens to be. Restores the land
# cruising speed (.speed) and hands the speed back to the ocean system with
# fresh counters (it was skipped entirely while sky mode was on).
scoreboard players set .SKYMODE ir 0
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .speed ir
function infinite_rail:set_speed with storage infinite_rail:speed
scoreboard players set .fast ir 0
scoreboard players set .oceanRun ir 0
scoreboard players set .landRun ir 0
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Sky mode OFF - gliding back down to the terrain.","color":"gray"}]
