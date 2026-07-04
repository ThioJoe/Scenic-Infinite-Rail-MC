# Enter ocean cruising speed: mark the fast state and push #OCEANSPEED into the
# minecart max-speed gamerule. Called by ocean_check on the ocean threshold.
scoreboard players set #fast ir 1
execute store result storage infinite_rail:speed v int 1 run scoreboard players get #OCEANSPEED ir
function infinite_rail:set_speed with storage infinite_rail:speed
