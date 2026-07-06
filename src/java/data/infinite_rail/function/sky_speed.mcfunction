# Applies the sky-mode cruising speed (.SKYSPEED) to the minecart max-speed
# gamerule. Split out of mode_sky_on because begin re-applies it too: a ride
# started while sky mode is already on must not launch at the land speed.
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .SKYSPEED cfg_ride
function infinite_rail:set_speed with storage infinite_rail:speed
