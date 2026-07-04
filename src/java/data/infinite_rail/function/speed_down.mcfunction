# Restore the configured default speed (#MAXSPEED). Called by ocean_check once,
# on the transition back to land (after #LANDCHUNKS non-ocean chunks). Not
# re-applied afterwards, so you can still tweak the gamerule by hand on land.
execute store result storage infinite_rail:speed v int 1 run scoreboard players get #MAXSPEED ir
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score #DEBUGMODE ir matches 1 run tellraw @a [{"text":"[IR debug] ","color":"dark_aqua"},{"text":"slowing down over land, speed ","color":"yellow"},{"score":{"name":"#MAXSPEED","objective":"ir"},"color":"white"}]
scoreboard players set #fast ir 0
