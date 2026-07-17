# Places one descending track column (rail is 1 lower than the previous column,
# sloping up toward the west behind it) on a hidden block of redstone.
# Support must be placed before the rail (see place_flat).
# .TUNNELUP = .TUNNELCLEAR + 1: slope columns carve one block taller than flat ones
# (and always clear their full center bore -- .veg is 0 on slope columns).
scoreboard players operation .ch ir = .TUNNELUP ir
execute store result storage infinite_rail:carve h int 1 run scoreboard players get .TUNNELUP ir
function infinite_rail:carve
# Invisible track (.HIDETRACK): skip the visible rail + support (see place_flat).
execute unless score .HIDETRACK ir matches 1 run function infinite_rail:support
execute unless score .HIDETRACK ir matches 1 run setblock ~ ~ ~ minecraft:powered_rail[shape=ascending_west,powered=true]
function infinite_rail:place_light
