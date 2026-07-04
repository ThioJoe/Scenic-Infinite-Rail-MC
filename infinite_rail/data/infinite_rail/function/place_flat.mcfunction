# Places one flat track column. Must run positioned at the head marker
# (marker Y = rail Y). Carving 3 wide x 5 tall handles tunnels through
# mountains and cuts through forests; over open ground it just clears air.
fill ~ ~ ~-1 ~ ~4 ~1 minecraft:air
setblock ~ ~-3 ~ minecraft:smooth_stone
setblock ~ ~-2 ~ minecraft:redstone_torch
setblock ~ ~-1 ~ minecraft:smooth_stone
setblock ~ ~ ~ minecraft:powered_rail[shape=east_west,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
function infinite_rail:shield
