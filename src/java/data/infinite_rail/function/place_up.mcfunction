# Places one climbing track column (rail ascends 1 block toward the east) on a
# hidden block of redstone. Extra headroom is carved since the cart rises here.
# Support must be placed before the rail (see place_flat).
# #TUNNELUP = #TUNNEL + 1: slope columns carve one block taller than flat ones
# (and always clear their full center bore -- #veg is 0 on slope columns).
scoreboard players operation #ch ir = #TUNNELUP ir
execute store result storage infinite_rail:carve h int 1 run scoreboard players get #TUNNELUP ir
function infinite_rail:carve
function infinite_rail:support
setblock ~ ~ ~ minecraft:powered_rail[shape=ascending_east,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
