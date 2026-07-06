# Enforce ocean cruising speed (.OCEANSPEED). Called by ocean_check on EVERY
# ocean chunk past the threshold, so the configured speed is re-applied and
# always wins -- self-healing any manual /gamerule change or desynced state.
# The debug message and the .fast flag flip happen only on the first call (while
# .fast is still 0), so there's no spam while cruising.
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .OCEANSPEED cfg_ride
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .DEBUGMODE ir matches 1 if score .fast ir matches 0 run tellraw @a [{"text":"[IR debug] ","color":"dark_aqua"},{"text":"switching to fast ocean mode, speed ","color":"aqua"},{"score":{"name":".OCEANSPEED","objective":"cfg_ride"},"color":"white"}]
scoreboard players set .fast ir 1
