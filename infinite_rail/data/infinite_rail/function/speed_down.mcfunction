# Return to the configured default speed: clear the fast state and push
# #MAXSPEED into the minecart max-speed gamerule. Called by ocean_check once
# enough non-ocean chunks have passed.
scoreboard players set #fast ir 0
execute store result storage infinite_rail:speed v int 1 run scoreboard players get #MAXSPEED ir
function infinite_rail:set_speed with storage infinite_rail:speed
